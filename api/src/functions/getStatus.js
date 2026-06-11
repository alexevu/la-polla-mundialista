const { app } = require('@azure/functions');
const { getTableClient, PARTITION_KEY } = require('../shared/tableService');

app.http('getStatus', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'status',
    handler: async (request, context) => {
        try {
            const name = request.query.get('name');
            if (!name || name.trim() === '') {
                return { status: 400, body: 'El nombre es requerido.' };
            }

            const cleanName = name.trim();
            const normalizedName = cleanName.toLowerCase().replace(/\s+/g, '');
            const client = await getTableClient();

            try {
                // Search for the participant entity
                const participant = await client.getEntity(PARTITION_KEY, `Participant_${normalizedName}`);
                return {
                    status: 200,
                    jsonBody: {
                        registered: true,
                        name: participant.OriginalName,
                        team: participant.AssignedTeam,
                        drawTime: participant.DrawTime
                    }
                };
            } catch (err) {
                // If 404, the participant is not registered yet
                if (err.statusCode === 404) {
                    return {
                        status: 200,
                        jsonBody: {
                            registered: false
                        }
                    };
                }
                throw err;
            }
        } catch (error) {
            context.log(`Error en getStatus: ${error.message}`);
            return { 
                status: 500, 
                body: `Error interno del servidor: ${error.message}` 
            };
        }
    }
});
