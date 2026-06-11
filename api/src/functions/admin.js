const { app } = require('@azure/functions');
const { getTableClient, PARTITION_KEY } = require('../shared/tableService');

app.http('admin', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'manage/{action}',
    handler: async (request, context) => {
        try {
            const action = request.params.action;
            const validActions = ['assignments', 'reset', 'config-teams', 'verify'];
            if (!validActions.includes(action)) {
                return { status: 404, body: 'Acción no encontrada.' };
            }

            // --- INICIO DE AUTENTICACIÓN CORREGIDA ---
            const authHeader = request.headers.get('authorization');
            const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

            // Registramos en Azure qué estamos recibiendo exactamente
            context.log(`-> Header de autorización recibido: ${authHeader}`);

            let tokenRecibido = '';
            // Validamos ignorando mayúsculas/minúsculas en la palabra "bearer"
            if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
                // Tomamos todo lo que está después de los primeros 7 caracteres ("bearer ")
                tokenRecibido = authHeader.substring(7).trim();
            }

            if (!authHeader || tokenRecibido !== expectedPassword) {
                context.log(`-> Acceso denegado. Se esperaba: ${expectedPassword} pero se recibió: ${tokenRecibido}`);
                return { status: 401, body: 'No autorizado. Contraseña incorrecta.' };
            }

            context.log("-> Autenticación exitosa");
            // --- FIN DE AUTENTICACIÓN CORREGIDA ---

            const client = await getTableClient();

            if (action === 'verify') {
                return { status: 200, jsonBody: { valid: true } };
            }

            if (action === 'assignments') {
                // Fetch all entities under PollaGame
                const teams = [];
                const participants = [];

                const entitiesIter = client.listEntities({
                    queryOptions: {
                        filter: `PartitionKey eq '${PARTITION_KEY}'`
                    }
                });

                for await (const entity of entitiesIter) {
                    if (entity.rowKey && entity.rowKey.startsWith("Team_")) {
                        teams.push({
                            name: entity.rowKey.substring(5),
                            isAvailable: entity.IsAvailable,
                            participant: entity.ParticipantName || '',
                            drawTime: entity.DrawTime || ''
                        });
                    } else if (entity.rowKey && entity.rowKey.startsWith("Participant_")) {
                        participants.push({
                            normalizedName: entity.rowKey.substring(12),
                            name: entity.OriginalName,
                            team: entity.AssignedTeam,
                            drawTime: entity.DrawTime
                        });
                    }
                }

                // Sort teams and participants for display readability
                teams.sort((a, b) => a.name.localeCompare(b.name));
                participants.sort((a, b) => new Date(a.drawTime) - new Date(b.drawTime));

                return {
                    status: 200,
                    jsonBody: { teams, participants }
                };
            }

            if (action === 'reset') {
                // Reset the game: delete all participants and make all teams available
                const entitiesIter = client.listEntities({
                    queryOptions: {
                        filter: `PartitionKey eq '${PARTITION_KEY}'`
                    }
                });

                const actions = [];
                for await (const entity of entitiesIter) {
                    if (entity.rowKey && entity.rowKey.startsWith("Participant_")) {
                        actions.push(["delete", { partitionKey: PARTITION_KEY, rowKey: entity.rowKey }]);
                    } else if (entity.rowKey && entity.rowKey.startsWith("Team_")) {
                        const resetTeam = {
                            partitionKey: PARTITION_KEY,
                            rowKey: entity.rowKey,
                            IsAvailable: true,
                            ParticipantName: "",
                            DrawTime: ""
                        };
                        actions.push(["update", resetTeam, "Replace"]);
                    }
                }

                if (actions.length > 0) {
                    // Batch in chunks of 100 (Azure Table Storage batch limit)
                    for (let i = 0; i < actions.length; i += 100) {
                        const batch = actions.slice(i, i + 100);
                        await client.submitTransaction(batch);
                    }
                }

                return {
                    status: 200,
                    jsonBody: { message: 'El sorteo ha sido reiniciado con éxito. Todos los participantes han sido eliminados y los equipos liberados.' }
                };
            }

            if (action === 'config-teams') {
                let body;
                try {
                    body = await request.json();
                } catch (err) {
                    return { status: 400, body: 'Cuerpo de petición JSON inválido.' };
                }

                const { teams } = body;
                if (!Array.isArray(teams) || teams.length === 0) {
                    return { status: 400, body: 'Debe proveer una lista de equipos válida.' };
                }

                // Delete ALL existing teams and participants first
                const entitiesIter = client.listEntities({
                    queryOptions: {
                        filter: `PartitionKey eq '${PARTITION_KEY}'`
                    }
                });

                const deleteActions = [];
                for await (const entity of entitiesIter) {
                    deleteActions.push(["delete", { partitionKey: PARTITION_KEY, rowKey: entity.rowKey }]);
                }

                if (deleteActions.length > 0) {
                    for (let i = 0; i < deleteActions.length; i += 100) {
                        const batch = deleteActions.slice(i, i + 100);
                        await client.submitTransaction(batch);
                    }
                }

                // Add new teams
                const createActions = [];
                for (const team of teams) {
                    const cleanTeam = team.trim();
                    if (cleanTeam === '') continue;

                    const teamEntity = {
                        partitionKey: PARTITION_KEY,
                        rowKey: `Team_${cleanTeam}`,
                        IsAvailable: true,
                        ParticipantName: "",
                        DrawTime: ""
                    };
                    createActions.push(["create", teamEntity]);
                }

                if (createActions.length > 0) {
                    for (let i = 0; i < createActions.length; i += 100) {
                        const batch = createActions.slice(i, i + 100);
                        await client.submitTransaction(batch);
                    }
                }

                return {
                    status: 200,
                    jsonBody: { message: 'Nueva lista de equipos configurada y sorteo reiniciado.' }
                };
            }

            return { status: 400, body: 'Acción no soportada.' };

        } catch (error) {
            context.log(`Error en admin: ${error.message}`);
            return {
                status: 500,
                body: `Error interno del servidor: ${error.message}`
            };
        }
    }
});