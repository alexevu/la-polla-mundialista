/**
 * Script de prueba de concurrencia para la Polla Mundialista.
 * 
 * Este script simula a 10 participantes enviando peticiones de sorteo al mismo tiempo.
 * Verifica que no ocurran duplicaciones de asignación de equipos y que la lógica 
 * transaccional y de reintentos funcione correctamente.
 * 
 * Requisitos:
 * 1. Tener el emulador corriendo localmente (swa start src --api-location api en puerto 4280).
 * 2. Haber reiniciado el sorteo para tener los 10 equipos libres.
 * 
 * Ejecución:
 * node concurrency-test.js
 */

const http = require('http');

const PORT = 4280;
const HOST = 'localhost';
const NAMES = [
  'Juan Perez', 'Maria Gomez', 'Carlos Ruiz', 'Ana Martinez', 'Luis Rodriguez',
  'Sofia Hernandez', 'Pedro Diaz', 'Lucia Alvarez', 'Diego Lopez', 'Elena Gomez'
];

function makeDrawRequest(name) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ name });
    
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/draw',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve({ name, ...JSON.parse(responseBody) });
          } catch (e) {
            reject(new Error(`Error parseando respuesta JSON para ${name}: ${responseBody}`));
          }
        } else {
          reject(new Error(`Petición fallida para ${name} con código ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Problema de conexión para ${name}: ${e.message}`));
    });

    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log(`=== Iniciando prueba de concurrencia para la Polla Mundialista ===`);
  console.log(`Enviando ${NAMES.length} solicitudes de sorteo simultáneas...`);
  
  const startTime = Date.now();
  try {
    const promises = NAMES.map(name => makeDrawRequest(name));
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    console.log(`\n¡Todas las peticiones finalizaron en ${duration}ms!`);
    console.log(`\nResultados del sorteo:`);
    
    const assignedTeams = new Set();
    let duplicatesFound = false;

    results.forEach(res => {
      console.log(`- ${res.name} -> Equipo Asignado: ${res.team} (Registro ya existente: ${res.alreadyRegistered})`);
      if (assignedTeams.has(res.team)) {
        console.error(`  ⚠️ ¡ALERTA! El equipo "${res.team}" fue asignado más de una vez.`);
        duplicatesFound = true;
      }
      assignedTeams.add(res.team);
    });

    console.log(`\nResumen de la validación:`);
    console.log(`- Equipos únicos asignados: ${assignedTeams.size} de ${NAMES.length}`);
    
    if (duplicatesFound) {
      console.error(`❌ PRUEBA FALLIDA: Se detectaron asignaciones duplicadas.`);
    } else if (assignedTeams.size === NAMES.length) {
      console.log(`✅ PRUEBA EXITOSA: No se encontraron colisiones. La base de datos es consistente y transaccional.`);
    } else {
      console.warn(`⚠️ PRUEBA INCOMPLETA: Se asignaron menos de ${NAMES.length} equipos únicos (probablemente no todos los registros fueron exitosos).`);
    }

  } catch (error) {
    console.error(`\n❌ ERROR DURANTE LA PRUEBA:\n`, error.message);
    console.log(`\nPor favor, asegúrate de que el emulador SWA esté corriendo en el puerto ${PORT} con Azurite activo.`);
  }
}

runTest();
