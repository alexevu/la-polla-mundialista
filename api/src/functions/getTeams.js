const { app } = require('@azure/functions');
const { getTableClient, PARTITION_KEY } = require('../shared/tableService');

app.http('getTeams', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'teams',
    handler: async (request, context) => {
        try {
            const client = await getTableClient();
            const teams = [];

            const entitiesIter = client.listEntities({
                queryOptions: {
                    filter: `PartitionKey eq '${PARTITION_KEY}'`
                }
            });

            for await (const entity of entitiesIter) {
                if (entity.rowKey && entity.rowKey.startsWith("Team_")) {
                    teams.push({
                        name: entity.rowKey.substring(5),
                        isAvailable: entity.IsAvailable
                    });
                }
            }

            // Sort teams alphabetically
            teams.sort((a, b) => a.name.localeCompare(b.name));

            return {
                status: 200,
                jsonBody: { teams }
            };
        } catch (error) {
            context.log(`Error en getTeams: ${error.message}`);
            return {
                status: 500,
                body: `Error interno del servidor: ${error.message}`
            };
        }
    }
});
