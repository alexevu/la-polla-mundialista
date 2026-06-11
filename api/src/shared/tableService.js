const { TableClient } = require("@azure/data-tables");

const connectionString = process.env.AzureTableStorageConnectionString || "UseDevelopmentStorage=true";
const tableName = "PollaData";

const defaultTeams = [
  "Argentina", "Brasil", "España", "Francia", "Inglaterra",
  "Alemania", "Portugal", "Países Bajos", "Colombia", "Uruguay"
];

let client = null;

async function initializeTeamsIfEmpty(tableClient) {
  try {
    const teamsIter = tableClient.listEntities({
      queryOptions: {
        filter: "PartitionKey eq 'PollaGame'"
      }
    });

    let hasTeams = false;
    for await (const entity of teamsIter) {
      if (entity.rowKey && entity.rowKey.startsWith("Team_")) {
        hasTeams = true;
        break;
      }
    }

    if (!hasTeams) {
      console.log("Inicializando lista inicial de 10 equipos...");
      for (const team of defaultTeams) {
        const teamEntity = {
          partitionKey: "PollaGame",
          rowKey: `Team_${team}`,
          IsAvailable: true,
          ParticipantName: "",
          DrawTime: ""
        };
        await tableClient.createEntity(teamEntity);
      }
      console.log("Equipos inicializados correctamente.");
    }
  } catch (err) {
    console.error("Error al inicializar equipos:", err.message);
  }
}

async function getTableClient() {
  if (!client) {
    client = TableClient.fromConnectionString(connectionString, tableName, {
      allowInsecureConnection: true
    });
    try {
      await client.createTable();
    } catch (err) {
      if (err.statusCode !== 409) {
        throw err;
      }
    }
    // Automatically initialize default teams if none exist
    await initializeTeamsIfEmpty(client);
  }
  return client;
}

module.exports = {
  getTableClient,
  PARTITION_KEY: "PollaGame",
  defaultTeams
};

