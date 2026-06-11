const { app } = require('@azure/functions');
const { getTableClient, PARTITION_KEY } = require('../shared/tableService');

app.http('draw', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'draw',
    handler: async (request, context) => {
        try {
            let body;
            try {
                body = await request.json();
            } catch (err) {
                return { status: 400, body: 'Cuerpo de petición JSON inválido.' };
            }

            const { name } = body;
            if (!name || name.trim() === '') {
                return { status: 400, body: 'El nombre del participante es requerido.' };
            }

            const cleanName = name.trim();
            const normalizedName = cleanName.toLowerCase().replace(/\s+/g, '');
            const client = await getTableClient();

            // 1. Check if participant already exists
            try {
                const existing = await client.getEntity(PARTITION_KEY, `Participant_${normalizedName}`);
                return {
                    status: 200,
                    jsonBody: {
                        alreadyRegistered: true,
                        name: existing.OriginalName,
                        team: existing.AssignedTeam,
                        drawTime: existing.DrawTime
                    }
                };
            } catch (err) {
                if (err.statusCode !== 404) {
                    throw err;
                }
            }

            // 2. Perform the draw with concurrency/transaction handling
            let retries = 5;
            let success = false;
            let assignedTeam = null;
            const nowStr = new Date().toISOString();

            while (retries > 0 && !success) {
                // Get all available teams
                const availableTeams = [];
                const teamsIter = client.listEntities({
                    queryOptions: {
                        filter: "PartitionKey eq 'PollaGame' and IsAvailable eq true"
                    }
                });

                for await (const entity of teamsIter) {
                    if (entity.rowKey && entity.rowKey.startsWith("Team_")) {
                        availableTeams.push(entity);
                    }
                }

                if (availableTeams.length === 0) {
                    return {
                        status: 400,
                        jsonBody: {
                            error: 'No quedan equipos disponibles. ¡El sorteo está lleno!'
                        }
                    };
                }

                // Choose a random team
                const randomIndex = Math.floor(Math.random() * availableTeams.length);
                const selectedTeamEntity = availableTeams[randomIndex];
                const teamName = selectedTeamEntity.rowKey.substring(5); // remove "Team_"

                // Prepare entity changes
                const updatedTeamEntity = {
                    partitionKey: PARTITION_KEY,
                    rowKey: selectedTeamEntity.rowKey,
                    IsAvailable: false,
                    ParticipantName: cleanName,
                    DrawTime: nowStr
                };

                const participantEntity = {
                    partitionKey: PARTITION_KEY,
                    rowKey: `Participant_${normalizedName}`,
                    OriginalName: cleanName,
                    AssignedTeam: teamName,
                    DrawTime: nowStr
                };

                // Submit batch transaction.
                // In @azure/data-tables, transactions are specified as actions.
                // Action format: { actionType: "create"|"update"|"delete", entity: entity }
                // Let's use the object action type format which is supported and robust.
                try {
                    const transactionActions = [
                        [
                            "update",
                            updatedTeamEntity,
                            "Replace",
                            { ifMatch: selectedTeamEntity.etag }
                        ],
                        [
                            "create",
                            participantEntity
                        ]
                    ];

                    await client.submitTransaction(transactionActions);
                    success = true;
                    assignedTeam = teamName;
                } catch (err) {
                    context.log(`Error de concurrencia/transacción (Intentos restantes: ${retries}): ${err.message}`);
                    
                    // If participant already exists, another request registered them in the meantime
                    if (err.statusCode === 409 && err.message.includes("EntityAlreadyExists")) {
                        const existing = await client.getEntity(PARTITION_KEY, `Participant_${normalizedName}`);
                        return {
                            status: 200,
                            jsonBody: {
                                alreadyRegistered: true,
                                name: existing.OriginalName,
                                team: existing.AssignedTeam,
                                drawTime: existing.DrawTime
                            }
                        };
                    }

                    // Only retry on Precondition Failed (412) which indicates ETag concurrency mismatch
                    if (err.statusCode === 412) {
                        retries--;
                        if (retries > 0) {
                            // Exponential backoff with jitter
                            const delay = Math.floor(Math.random() * 80) + 20;
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue;
                        }
                    }
                    
                    // Throw any other error (e.g. database down, serialization error) so it fails fast
                    throw err;
                }
            }

            return {
                status: 200,
                jsonBody: {
                    alreadyRegistered: false,
                    name: cleanName,
                    team: assignedTeam,
                    drawTime: nowStr
                }
            };

        } catch (error) {
            context.log(`Error en draw: ${error.message}`);
            return {
                status: 500,
                body: `Error interno del servidor: ${error.message}`
            };
        }
    }
});
