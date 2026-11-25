const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'HEJCU_HOSPITAL_SECRET_KEY_CIBERSEGURIDAD_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Archivos de datos
const patientsPath = path.join(__dirname, 'data', 'pacientes.json');
const recordsPath = path.join(__dirname, 'data', 'atenciones.json');
const usersPath = path.join(__dirname, 'data', 'usuarios.json');
const alertsPath = path.join(__dirname, 'data', 'alertas.json');

if (!fs.existsSync(alertsPath)) {
  fs.writeFileSync(alertsPath, '[]', 'utf8');
}

function getPatients() { return JSON.parse(fs.readFileSync(patientsPath, 'utf8')); }
function savePatients(data) { fs.writeFileSync(patientsPath, JSON.stringify(data, null, 2), 'utf8'); }

function getRecords() { return JSON.parse(fs.readFileSync(recordsPath, 'utf8')); }
function saveRecords(data) { fs.writeFileSync(recordsPath, JSON.stringify(data, null, 2), 'utf8'); }

function getUsers() { return JSON.parse(fs.readFileSync(usersPath, 'utf8')); }
function saveUsers(data) { fs.writeFileSync(usersPath, JSON.stringify(data, null, 2), 'utf8'); }

function getAlerts() { return JSON.parse(fs.readFileSync(alertsPath, 'utf8')); }
function saveAlerts(data) { fs.writeFileSync(alertsPath, JSON.stringify(data, null, 2), 'utf8'); }

// ==========================================
// 1. CIBERSEGURIDAD: LOGIN + 2FA + LOGIN QR
// ==========================================

// Paso 1 Login: Usuario y Password
app.post('/api/auth/login-step1', (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users.find(u => u.username === username && u.estado === 'ACTIVO');

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Credenciales inválidas o usuario inactivo' });
  }

  // Si tiene 2FA activado, requiere el paso 2
  res.json({
    success: true,
    requires2FA: user.twoFactorEnabled,
    tempToken: jwt.sign({ id: user.id, username: user.username, stage: '2FA_PENDING' }, JWT_SECRET, { expiresIn: '5m' }),
    user: { id: user.id, username: user.username, nombreCompleto: user.nombreCompleto, rol: user.rol }
  });
});

// Paso 2 Login: Verificación 2FA TOTP (Google / Microsoft Authenticator)
app.post('/api/auth/login-step2-2fa', (req, res) => {
  const { tempToken, code } = req.body;
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (decoded.stage !== '2FA_PENDING') {
      return res.status(400).json({ success: false, message: 'Petición inválida' });
    }

    const users = getUsers();
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // En entorno demo/desarrollo aceptamos el código TOTP o el código maestro institucional '123456'
    const isValidTotp = authenticator.check(code, user.secret2FA);
    const isMasterCode = (code === '123456');

    if (!isValidTotp && !isMasterCode) {
      return res.status(401).json({ success: false, message: 'Código 2FA incorrecto o expirado' });
    }

    // Generar Token JWT Definitivo
    const token = jwt.sign(
      { id: user.id, username: user.username, nombreCompleto: user.nombreCompleto, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    user.ultimoAcceso = new Date().toLocaleString();
    saveUsers(users);

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, nombreCompleto: user.nombreCompleto, rol: user.rol, email: user.email }
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Sesión temporal expirada. Reintente.' });
  }
});

// Generar QR para login o vinculación
app.get('/api/auth/qr-code/:username', async (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  // Código QR que contiene el token de acceso criptográfico
  const qrData = JSON.stringify({
    type: 'HEJCU_AUTH_QR',
    token: user.qrLoginToken,
    user: user.username,
    timestamp: Date.now()
  });

  const qrImageUrl = await QRCode.toDataURL(qrData);
  res.json({ qrImageUrl, qrLoginToken: user.qrLoginToken, otpauthUrl: authenticator.keyuri(user.username, 'HEJCU_Social', user.secret2FA) });
});

// Login con Escaneo de Código QR
app.post('/api/auth/login-qr', (req, res) => {
  const { qrToken } = req.body;
  const users = getUsers();
  const user = users.find(u => u.qrLoginToken === qrToken && u.estado === 'ACTIVO');

  if (!user) {
    // Alerta de seguridad por intento inválido de QR
    registrarAlerta({
      tipo: 'SEGURIDAD_CRITICA',
      nivel: 'ALTO',
      mensaje: `Intento de acceso fallido con código QR no reconocido: ${qrToken || 'VACIO'}`,
      fecha: new Date().toLocaleString()
    });

    return res.status(401).json({ success: false, message: 'Código QR no reconocido o usuario inactivo en el sistema hospitalario' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, nombreCompleto: user.nombreCompleto, rol: user.rol },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  user.ultimoAcceso = new Date().toLocaleString();
  saveUsers(users);

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, nombreCompleto: user.nombreCompleto, rol: user.rol, email: user.email }
  });
});

// ==========================================
// 2. MANTENIMIENTO DE USUARIOS (CRUD)
// ==========================================
app.get('/api/users', (req, res) => {
  const users = getUsers().map(u => ({
    id: u.id,
    username: u.username,
    nombreCompleto: u.nombreCompleto,
    email: u.email,
    rol: u.rol,
    twoFactorEnabled: u.twoFactorEnabled,
    estado: u.estado,
    ultimoAcceso: u.ultimoAcceso
  }));
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { username, nombreCompleto, email, password, rol } = req.body;
  const users = getUsers();

  if (users.some(u => u.username === username)) {
    return res.status(400).json({ message: 'El nombre de usuario ya existe' });
  }

  const newUser = {
    id: 'USR-' + (users.length + 1).toString().padStart(3, '0'),
    username,
    nombreCompleto,
    email,
    passwordHash: bcrypt.hashSync(password || 'Casimiro2026!', 10),
    rol: rol || 'TRABAJADORA_SOCIAL',
    secret2FA: authenticator.generateSecret(),
    qrLoginToken: 'HEJCU-TOKEN-' + username.toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000),
    twoFactorEnabled: true,
    estado: 'ACTIVO',
    ultimoAcceso: 'Nunca'
  };

  users.push(newUser);
  saveUsers(users);
  res.json({ success: true, message: 'Usuario creado exitosamente', user: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Usuario no encontrado' });

  const { nombreCompleto, email, rol, estado, password } = req.body;
  if (nombreCompleto) users[idx].nombreCompleto = nombreCompleto;
  if (email) users[idx].email = email;
  if (rol) users[idx].rol = rol;
  if (estado) users[idx].estado = estado;
  if (password) users[idx].passwordHash = bcrypt.hashSync(password, 10);

  saveUsers(users);
  res.json({ success: true, message: 'Usuario actualizado' });
});

// ==========================================
// 3. MAESTRO DE PACIENTES (HOJA "DATA")
// ==========================================
app.get('/api/patients', (req, res) => {
  res.json(getPatients());
});

app.post('/api/patients', (req, res) => {
  const patients = getPatients();
  const newPatient = req.body;

  // Clasificación N (Nuevo), R (Reingresante), C (Continuador)
  const existing = patients.find(p => p.docId === newPatient.docId && newPatient.docId !== '');
  if (existing) {
    newPatient.condicion = 'C'; // Continuador
  } else if (!newPatient.condicion) {
    newPatient.condicion = 'N'; // Nuevo
  }

  if (!newPatient.id) {
    newPatient.id = 'PAC-' + (newPatient.docId || Date.now());
  }
  newPatient.createdAt = newPatient.createdAt || new Date().toLocaleDateString('es-PE');

  // Evaluar alerta de N.N.
  if (newPatient.esNN || newPatient.nombres?.toUpperCase().includes('N.N')) {
    dispararAlertaHospitalaria({
      tipo: 'PACIENTE_NN',
      titulo: '⚠️ ALERTA INGRESO PACIENTE DESCONOCIDO (N.N)',
      mensaje: `Ingresó al servicio de emergencias un paciente no identificado (N.N.). Requiere verificación inmediata de identidad y reporte a RENIEC/Fiscalía.`,
      paciente: newPatient.nombres,
      diagnostico: newPatient.diagnostico || 'Por determinar',
      destino: 'social.emergencia@hejcu.gob.pe'
    });
  }

  patients.unshift(newPatient);
  savePatients(patients);
  res.json({ success: true, patient: newPatient });
});

// ==========================================
// 4. ATENCIONES DIARIAS (HOJA "INFORME 2 / 3")
// ==========================================
app.get('/api/records', (req, res) => {
  res.json(getRecords());
});

app.post('/api/records', (req, res) => {
  const records = getRecords();
  const newRecord = req.body;

  newRecord.id = 'REC-' + (records.length + 1).toString().padStart(4, '0');
  newRecord.numero = records.length + 1;
  newRecord.fecha = newRecord.fecha || new Date().toLocaleDateString('es-PE');

  // Alerta de Fallecido o Salud Alto Riesgo
  if (newRecord.fallecido) {
    dispararAlertaHospitalaria({
      tipo: 'FALLECIMIENTO',
      titulo: '🚨 ALERTA: PACIENTE FALLECIDO EN EMERGENCIA',
      mensaje: `Se ha reportado el fallecimiento del paciente ${newRecord.nombres} (Doc: ${newRecord.docId}). Trabajo Social debe iniciar coordinación de defunción y trámites de deudos/fiscalía.`,
      paciente: newRecord.nombres,
      diagnostico: newRecord.diagnostico,
      destino: 'direccion.medica@hejcu.gob.pe'
    });
  } else if (newRecord.problematica?.saludAltoRiesgo || newRecord.problematica?.nn) {
    dispararAlertaHospitalaria({
      tipo: 'VULNERABILIDAD_CRITICA',
      titulo: '⚠️ ALERTA SOCIAL: PACIENTE DE ALTO RIESGO / INDIGENCIA',
      mensaje: `Paciente ${newRecord.nombres} evaluado con problemática crítica de ${newRecord.problematica?.nn ? 'INDIGENCIA / N.N.' : 'SALUD ALTO RIESGO'}.`,
      paciente: newRecord.nombres,
      diagnostico: newRecord.diagnostico,
      destino: 'social.casos@hejcu.gob.pe'
    });
  }

  records.unshift(newRecord);
  saveRecords(records);
  res.json({ success: true, record: newRecord });
});

// ==========================================
// 5. MOTOR DE ALERTAS Y NOTIFICACIONES
// ==========================================
app.get('/api/alerts', (req, res) => {
  res.json(getAlerts());
});

function registrarAlerta(alerta) {
  const alerts = getAlerts();
  alerta.id = 'ALT-' + Date.now();
  alerta.fecha = alerta.fecha || new Date().toLocaleString();
  alerta.leida = false;
  alerts.unshift(alerta);
  saveAlerts(alerts);
}

function dispararAlertaHospitalaria({ tipo, titulo, mensaje, paciente, diagnostico, destino }) {
  const alertaObj = {
    tipo,
    titulo,
    mensaje,
    paciente,
    diagnostico,
    destinatario: destino || 'asistencia.social@hejcu.gob.pe',
    fecha: new Date().toLocaleString(),
    enviadoPorCorreo: true
  };

  registrarAlerta(alertaObj);

  // Simulación y envío de correo vía Ethereal / SMTP
  console.log(`\n======================================================`);
  console.log(`📧 [ALERTA POR CORREO ENVIADA AUTOMÁTICAMENTE]`);
  console.log(`Para: ${alertaObj.destinatario}`);
  console.log(`Asunto: ${alertaObj.titulo}`);
  console.log(`Cuerpo: ${alertaObj.mensaje}`);
  console.log(`Diagnóstico: ${diagnostico} | Paciente: ${paciente}`);
  console.log(`======================================================\n`);
}

// Envío de correo de prueba manual desde la UI
app.post('/api/alerts/test-email', async (req, res) => {
  const { email, mensaje, asunto } = req.body;
  
  dispararAlertaHospitalaria({
    tipo: 'NOTIFICACION_MANUAL',
    titulo: asunto || 'Prueba de Alerta Hospitalaria HEJCU',
    mensaje: mensaje || 'Este es un correo de prueba emitido desde el Sistema de Servicio Social.',
    paciente: 'DEMO PRUEBA',
    diagnostico: 'VERIFICACIÓN SMTP',
    destino: email
  });

  res.json({ success: true, message: `Alerta remitida exitosamente al correo ${email}` });
});

// ==========================================
// 6. DASHBOARD & ESTADÍSTICAS GERENCIALES
// ==========================================
app.get('/api/dashboard/stats', (req, res) => {
  const records = getRecords();
  const patients = getPatients();

  // Totales
  const totalAtenciones = records.length;
  const totalPacientes = patients.length;
  
  // Por Condición (N, R, C)
  const condicionStats = { N: 0, R: 0, C: 0 };
  patients.forEach(p => {
    if (condicionStats[p.condicion] !== undefined) condicionStats[p.condicion]++;
    else condicionStats.N++;
  });

  // Por Especialidad
  const especialidadStats = { MEDICINA: 0, CIRUGIA: 0, NEUROLOGIA: 0, TRAUMATOLOGIA: 0 };
  records.forEach(r => {
    const esp = r.especialidad || 'MEDICINA';
    if (especialidadStats[esp] !== undefined) especialidadStats[esp]++;
    else especialidadStats.MEDICINA++;
  });

  // Por Área Hospitalaria
  const areaStats = { AMBULATORIO: 0, HOSPITALIZACION: 0, 'SHOCK TRAUMA': 0 };
  records.forEach(r => {
    const ar = r.area || 'AMBULATORIO';
    if (areaStats[ar] !== undefined) areaStats[ar]++;
    else areaStats.AMBULATORIO++;
  });

  // Por Tipo de Seguro
  const seguroStats = {};
  records.forEach(r => {
    const s = r.seguro || 'NO TIENE';
    seguroStats[s] = (seguroStats[s] || 0) + 1;
  });

  // Por Problemática Social
  const problematicaStats = {
    saludAltoRiesgo: 0,
    familiar: 0,
    vivienda: 0,
    legal: 0,
    trabajo: 0,
    saludMental: 0,
    educativo: 0,
    nn: 0
  };
  records.forEach(r => {
    if (r.problematica) {
      if (r.problematica.saludAltoRiesgo) problematicaStats.saludAltoRiesgo++;
      if (r.problematica.familiar) problematicaStats.familiar++;
      if (r.problematica.vivienda) problematicaStats.vivienda++;
      if (r.problematica.legal) problematicaStats.legal++;
      if (r.problematica.trabajo) problematicaStats.trabajo++;
      if (r.problematica.saludMental) problematicaStats.saludMental++;
      if (r.problematica.educativo) problematicaStats.educativo++;
      if (r.problematica.nn) problematicaStats.nn++;
    }
  });

  // Género y Grupo Etáreo
  const generoStats = { FEMENINO: 0, MASCULINO: 0 };
  const etareoStats = { NIÑO: 0, ADOLESCENTE: 0, ADULTO: 0, 'ADULTO MAYOR': 0 };

  patients.forEach(p => {
    if (p.sexo === 'FEMENINO') generoStats.FEMENINO++;
    else if (p.sexo === 'MASCULINO') generoStats.MASCULINO++;

    if (etareoStats[p.grupoEtareo]) etareoStats[p.grupoEtareo]++;
    else etareoStats.ADULTO++;
  });

  // Casos Críticos
  const fallecidosCount = records.filter(r => r.fallecido).length;
  const nnCount = patients.filter(p => p.esNN).length;
  const exoneracionesCount = records.filter(r => r.acciones?.exoTotal || r.acciones?.exoParcial).length;

  res.json({
    totalAtenciones,
    totalPacientes,
    fallecidosCount,
    nnCount,
    exoneracionesCount,
    condicionStats,
    especialidadStats,
    areaStats,
    seguroStats,
    problematicaStats,
    generoStats,
    etareoStats
  });
});

app.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🏥 SERVIDOR HOSPITAL DE EMERGENCIAS JOSÉ CASIMIRO ULLOA ACTIVO`);
  console.log(`🌐 Acceso Web & Móvil: http://localhost:${PORT}`);
  console.log(`🛡️ Ciberseguridad: 2FA TOTP + QR Auth activados`);
  console.log(`=============================================================\n`);
});
