const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 1. USUARIOS DEMO (Con contraseñas documentadas y 2FA funcional)
const users = [
  {
    id: "USR-001",
    username: "admin",
    nombreCompleto: "Ing. Jonathan Rangel (Admin Ciberseguridad)",
    email: "seguridad.demo@hospital-social.pe",
    passwordHash: "$2a$10$h.ST8Fn.T2fVcIwnz/XT3.zqPjNHeh4dU/mBF8MMC9xGiMmlb/wOK",
    rol: "ADMIN",
    secret2FA: "JBSWY3DPEHPK3PXP",
    qrLoginToken: "HEJCU-TOKEN-ADMIN-SEC-9988",
    twoFactorEnabled: true,
    estado: "ACTIVO",
    ultimoAcceso: "25/11/2026, 6:30:00 p. m."
  },
  {
    id: "USR-002",
    username: "ts_taravay",
    nombreCompleto: "Lic. Milagritos Taravay (Trabajo Social)",
    email: "trabajosocial.demo@hospital-social.pe",
    passwordHash: "$2a$10$8DDqJdTrbr5AYtIt/D61a.DA9oRl/5469iX93q7HF4CrKmYwBvQma",
    rol: "TRABAJADORA_SOCIAL",
    secret2FA: "KZXW6YTBOI=======",
    qrLoginToken: "HEJCU-TOKEN-TS-TARAVAY-7722",
    twoFactorEnabled: true,
    estado: "ACTIVO",
    ultimoAcceso: "25/11/2026, 5:45:00 p. m."
  },
  {
    id: "USR-003",
    username: "auditor_minsa",
    nombreCompleto: "Dr. Delegado Auditor (MINSA / EsSalud)",
    email: "auditoria.demo@minsa.gob.pe",
    passwordHash: "$2a$10$E5zK8J3vJp7rG5L6k1q3zeJ8v9r2w1y0u7t4r3e2w1q0p9o8n7m6l",
    rol: "DIRECTIVO_AUDITOR",
    secret2FA: "MFRGGZDFMZTWQ2LK",
    qrLoginToken: "HEJCU-TOKEN-AUDITOR-MINSA-4411",
    twoFactorEnabled: true,
    estado: "ACTIVO",
    ultimoAcceso: "25/11/2026, 4:15:00 p. m."
  }
];

fs.writeFileSync(path.join(dataDir, 'usuarios.json'), JSON.stringify(users, null, 2), 'utf8');

// 2. PACIENTES FICTICIOS (DEMO DATASET - LEY N° 29733 COMPLIANT)
const mockNombresM = [
  "QUISPE MAMANI CARLOS ENRIQUE", "FLORES RAMOS MARCO ANTONIO", "MENDOZA ROJAS JORGE LUIS",
  "SANCHEZ VEGA MANUEL AUGUSTO", "HUAMAN DIAZ CESAR ALBERTO", "ESPINOZA LOPEZ VICTOR HUGO",
  "CASTILLO SOTO MIGUEL ANGEL", "TORRES CHAVEZ LUIS FERNANDO", "GOMEZ PAREDES RAUL ALEJANDRO",
  "ALVAREZ CAMPOS EDWIN DAVID", "VARGAS GUTIERREZ RICARDO", "ROMERO DELGADO JAVIER ANDRES",
  "AGUILAR SILVA OSCAR EDUARDO", "MORALES CORDOVA DANIEL ISAAC", "RODRIGUEZ NAVARRO PEDRO PABLO",
  "CRUZ HERRERA JOSE MANUEL", "RIVERA BENITEZ ALONSO", "CAMPOS VALENCIA ARTURO GABRIEL",
  "HERRERA ZEVALLOS GONZALO", "PALACIOS MIRANDA FELIX ENRIQUE"
];

const mockNombresF = [
  "RAMIREZ CASTRO ROSA ELENA", "LOPEZ VILLANUEVA CARMEN ROSA", "GARCIA SALAZAR MARIA LUISA",
  "CHAVEZ GUTIERREZ PATRICIA", "PAREDES NUNEZ DIANA MARCELA", "DIAZ CORREA CLAUDIA BEATRIZ",
  "QUISPE VARGAS SILVIA MONICA", "FERNANDEZ ROJAS ELIZABETH", "SOTO CACERES TERESA DE JESUS",
  "ROJAS VALDIVIA ROCIO DEL PILAR", "MEDINA CORNEJO LUCIA ESTHER", "VILLANUEVA TAPIA ANA MARIA",
  "SALAS MONTES KAREN MARIELA", "BRAVO PACHECO JULIA BEATRIZ", "ACOSTA PONCE GLADYS NOEMI",
  "DELGADO RIVAS MERCEDES", "CANO GUZMAN MARTHA ISABEL", "MEZA OCHOA FLOR DE MARIA"
];

const seguros = ["SIS", "SIS", "SIS", "ESSALUD", "SOAT", "PARTICULAR", "NO TIENE"];
const condiciones = ["N", "N", "C", "C", "R"];
const especialidades = ["MEDICINA", "CIRUGIA", "NEUROLOGIA", "TRAUMATOLOGIA"];
const areas = ["SHOCK TRAUMA", "EMERGENCIA", "HOSPITALIZACION", "AMBULATORIO"];

const diagnosticos = [
  "POLITRAUMATISMO POR ACCIDENTE DE TRANSITO",
  "APENDICITIS AGUDA COMPLICADA",
  "TRAUMATISMO ENCEFALO CRANEANO MODERADO (TEC)",
  "INSUFICIENCIA RESPIRATORIA AGUDA",
  "ACCIDENTE CEREBRO VASCULAR ISQUEMICO (ACV)",
  "FRACTURA EXPUESTA DE TIBIA Y PERONE",
  "GASTROENTERITIS AGUDA CON DESHIDRATACION SEVERA",
  "CRISIS HIPERTENSIVA NO CONTROLADA",
  "PANCREATITIS AGUDA",
  "HEMORRAGIA DIGESTIVA ALTA",
  "INTOXICACION MEDICAMENTOSA",
  "COVID-19 SOSPECHOSO CON DIFICULTAD RESPIRATORIA"
];

const patients = [];
const records = [];

let patientCounter = 1;

// Crear 2 casos especiales NN / Indigente
patients.push({
  id: "PAC-NN-001",
  docId: "NN-001",
  nombres: "PACIENTE N.N. (INDIGENTE - HALLADO EN VIA PUBLICA)",
  pais: "PERU",
  sexo: "MASCULINO",
  edad: 58,
  grupoEtareo: "ADULTO",
  seguro: "SIS",
  condicion: "N",
  contactos: "Sin red familiar identificada - Caso social crítico",
  esNN: true,
  createdAt: "01.10.2026"
});

patients.push({
  id: "PAC-NN-002",
  docId: "NN-002",
  nombres: "PACIENTE N.N. (DESCONOCIDO - INGRESADO POR SAMU)",
  pais: "PERU",
  sexo: "FEMENINO",
  edad: 72,
  grupoEtareo: "ADULTO MAYOR",
  seguro: "NO TIENE",
  condicion: "N",
  contactos: "Ingreso en estado de inconsciencia sin documentos",
  esNN: true,
  createdAt: "05.10.2026"
});

// Generar pacientes masculinos
mockNombresM.forEach((nom, idx) => {
  const edad = 18 + ((idx * 7) % 65);
  let grupoEtareo = "ADULTO";
  if (edad < 12) grupoEtareo = "NIÑO";
  else if (edad < 18) grupoEtareo = "ADOLESCENTE";
  else if (edad >= 60) grupoEtareo = "ADULTO MAYOR";

  const docId = "70" + String(100000 + idx * 3421).padStart(6, '0');
  patients.push({
    id: `PAC-${docId}`,
    docId,
    nombres: nom,
    pais: idx % 8 === 0 ? "VENEZUELA" : "PERU",
    sexo: "MASCULINO",
    edad,
    grupoEtareo,
    seguro: seguros[idx % seguros.length],
    condicion: condiciones[idx % condiciones.length],
    contactos: "Familiar de contacto registrado",
    esNN: false,
    createdAt: `${String(1 + (idx % 28)).padStart(2, '0')}.10.2026`
  });
});

// Generar pacientes femeninos
mockNombresF.forEach((nom, idx) => {
  const edad = 8 + ((idx * 9) % 75);
  let grupoEtareo = "ADULTO";
  if (edad < 12) grupoEtareo = "NIÑO";
  else if (edad < 18) grupoEtareo = "ADOLESCENTE";
  else if (edad >= 60) grupoEtareo = "ADULTO MAYOR";

  const docId = "45" + String(200000 + idx * 4153).padStart(6, '0');
  patients.push({
    id: `PAC-${docId}`,
    docId,
    nombres: nom,
    pais: idx % 10 === 0 ? "COLOMBIA" : "PERU",
    sexo: "FEMENINO",
    edad,
    grupoEtareo,
    seguro: seguros[(idx + 2) % seguros.length],
    condicion: condiciones[(idx + 1) % condiciones.length],
    contactos: "Familiar directo disponible",
    esNN: false,
    createdAt: `${String(2 + (idx % 27)).padStart(2, '0')}.10.2026`
  });
});

// Generar atenciones hospitalarias vinculadas
patients.forEach((p, idx) => {
  const recordId = `REC-${String(idx + 1).padStart(4, '0')}`;
  const esp = especialidades[idx % especialidades.length];
  const ar = areas[idx % areas.length];
  const diag = diagnosticos[idx % diagnosticos.length];
  const isFallecido = (idx === 14 || idx === 32);

  records.push({
    id: recordId,
    numero: idx + 1,
    fecha: p.createdAt,
    patientId: p.id,
    docId: p.docId,
    nombres: p.nombres,
    pais: p.pais,
    edad: p.edad,
    sexo: p.sexo,
    condicion: p.condicion,
    area: ar,
    especialidad: esp,
    diagnostico: diag,
    seguro: p.seguro,
    afiliacion: p.seguro === "SIS" ? "ACTIVA" : "",
    acciones: {
      evaluacion: idx % 2 === 0,
      entrevista: true,
      coordInt: idx % 3 === 0,
      coordExt: idx % 4 === 0,
      infSocial: idx % 2 !== 0,
      seguimiento: idx % 3 !== 0,
      orientacion: true,
      visitaDom: idx % 7 === 0,
      evacuaciones: idx % 9 === 0,
      interconsultas: idx % 5 === 0,
      pendientes: idx % 6 === 0,
      altas: idx % 4 === 0 && !isFallecido,
      exoTotal: p.esNN || (idx % 8 === 0),
      exoParcial: idx % 5 === 0,
      exoTrabTotal: false,
      exoTrabParcial: false
    },
    problematica: {
      saludAltoRiesgo: idx % 3 === 0,
      familiar: idx % 4 === 0 || p.esNN,
      vivienda: p.esNN || idx % 7 === 0,
      legal: idx % 9 === 0,
      trabajo: idx % 5 === 0,
      saludMental: idx % 6 === 0,
      educativo: idx % 8 === 0,
      nn: p.esNN
    },
    fallecido: isFallecido,
    covid19: idx % 11 === 0,
    contactos: p.contactos,
    observacion: p.esNN ? "Paciente indigente bajo custodia de Servicio Social HEJCU." : "Atención y triaje social completados formalmente."
  });
});

fs.writeFileSync(path.join(dataDir, 'pacientes.json'), JSON.stringify(patients, null, 2), 'utf8');
fs.writeFileSync(path.join(dataDir, 'atenciones.json'), JSON.stringify(records, null, 2), 'utf8');

// 3. ALERTAS DEMO INICIALES
const alertas = [
  {
    id: "ALT-DEMO-001",
    tipo: "ALERTA_SANITARIA_CRITICA",
    nivel: "ALTO",
    titulo: "Ingreso de Paciente N.N. Indigente en Shock Trauma",
    mensaje: "Se ha registrado el ingreso de un paciente no identificado sin red de soporte familiar. Coordinar con RENIEC y Policía Nacional.",
    paciente: "PACIENTE N.N. (INDIGENTE - HALLADO EN VIA PUBLICA)",
    diagnostico: "POLITRAUMATISMO POR ACCIDENTE DE TRANSITO",
    destinatario: "asistencia.social@hospital-demo.pe",
    fecha: "25/11/2026, 6:00:00 p. m.",
    leida: false,
    enviadoPorCorreo: true
  },
  {
    id: "ALT-DEMO-002",
    tipo: "SEGURIDAD_ACCESO",
    nivel: "MEDIO",
    titulo: "Inicio de Sesión con Doble Factor (2FA TOTP)",
    mensaje: "Acceso exitoso al módulo de auditoría mediante código criptográfico verificado.",
    paciente: "SISTEMA",
    diagnostico: "AUDITORIA DE SEGURIDAD",
    destinatario: "seguridad.ti@hospital-demo.pe",
    fecha: "25/11/2026, 6:25:00 p. m.",
    leida: true,
    enviadoPorCorreo: true
  }
];

fs.writeFileSync(path.join(dataDir, 'alertas.json'), JSON.stringify(alertas, null, 2), 'utf8');

console.log(`✅ Base de datos sintética generada con éxito:`);
console.log(`   - ${users.length} usuarios demo configurados con Bcrypt y 2FA.`);
console.log(`   - ${patients.length} pacientes sintéticos (Ley 29733 compliant).`);
console.log(`   - ${records.length} atenciones asistenciales para dashboards y reportes.`);
console.log(`   - ${alertas.length} alertas iniciales.`);
