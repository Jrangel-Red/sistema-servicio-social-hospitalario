// ==============================================================
// SISTEMA INTEGRAL DE SERVICIO SOCIAL HOSPITALARIO (HEJCU)
// ==============================================================

let currentUser = null;
let authToken = null;
let tempToken2FA = null;
let html5QrCode = null;

let allPatients = [];
let allRecords = [];
let allUsers = [];
let allAlerts = [];

let chartEspInstance = null;
let chartCondInstance = null;
let chartSegInstance = null;
let chartProbInstance = null;

// Registro de Service Worker para PWA Móvil
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW no registrado', err));
}

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('hejcu_token');
  const savedUser = localStorage.getItem('hejcu_user');

  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
    setupSessionUI();
  } else {
    document.getElementById('authScreen').classList.remove('hidden');
  }
});

// --------------------------------------------------------------
// GESTIÓN DE ACCESO (LOGIN, 2FA, QR AUTH)
// --------------------------------------------------------------

function switchLoginTab(tab) {
  const tabPass = document.getElementById('tabPasswordBtn');
  const tabQr = document.getElementById('tabQrBtn');
  const passContainer = document.getElementById('loginFormContainer');
  const qrContainer = document.getElementById('loginQrContainer');

  if (tab === 'password') {
    tabPass.className = 'flex-1 py-3 text-center border-b-2 border-blue-700 text-blue-700 transition font-bold';
    tabQr.className = 'flex-1 py-3 text-center border-b-2 border-transparent text-slate-600 transition';
    passContainer.classList.remove('hidden');
    qrContainer.classList.add('hidden');
    stopQrScanner();
  } else {
    tabQr.className = 'flex-1 py-3 text-center border-b-2 border-blue-700 text-blue-700 transition font-bold';
    tabPass.className = 'flex-1 py-3 text-center border-b-2 border-transparent text-slate-600 transition';
    qrContainer.classList.remove('hidden');
    passContainer.classList.add('hidden');
  }
}

async function handleLoginStep1(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const feedback = document.getElementById('loginFeedback');

  try {
    const res = await fetch('/api/auth/login-step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!data.success) {
      feedback.textContent = '❌ ' + data.message;
      feedback.className = 'mt-4 text-xs font-semibold text-center text-red-600 block';
      return;
    }

    if (data.requires2FA) {
      tempToken2FA = data.tempToken;
      document.getElementById('step1Form').classList.add('hidden');
      document.getElementById('step2Form').classList.remove('hidden');
      document.getElementById('twoFactorCode').focus();
      feedback.classList.add('hidden');
    }
  } catch (err) {
    feedback.textContent = '❌ Error de comunicación con el servidor';
    feedback.className = 'mt-4 text-xs font-semibold text-center text-red-600 block';
  }
}

async function handleLoginStep2(e) {
  e.preventDefault();
  const code = document.getElementById('twoFactorCode').value.trim();
  const feedback = document.getElementById('loginFeedback');

  try {
    const res = await fetch('/api/auth/login-step2-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: tempToken2FA, code })
    });
    const data = await res.json();

    if (!data.success) {
      feedback.textContent = '❌ ' + data.message;
      feedback.className = 'mt-4 text-xs font-semibold text-center text-red-600 block';
      return;
    }

    // Éxito
    completeLogin(data.token, data.user);
  } catch (err) {
    feedback.textContent = '❌ Error al validar código 2FA';
    feedback.className = 'mt-4 text-xs font-semibold text-center text-red-600 block';
  }
}

function cancel2FA() {
  document.getElementById('step2Form').classList.add('hidden');
  document.getElementById('step1Form').classList.remove('hidden');
  document.getElementById('loginFeedback').classList.add('hidden');
}

// Login con Token de Código QR
async function loginWithMockQr(qrToken) {
  const feedback = document.getElementById('qrFeedback');
  try {
    const res = await fetch('/api/auth/login-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken })
    });
    const data = await res.json();

    if (!data.success) {
      feedback.textContent = '❌ ' + data.message;
      feedback.className = 'mt-3 text-xs font-semibold text-red-600 block';
      return;
    }

    completeLogin(data.token, data.user);
  } catch (err) {
    feedback.textContent = '❌ Error al procesar credencial QR';
    feedback.className = 'mt-3 text-xs font-semibold text-red-600 block';
  }
}

// Iniciar escáner de cámara
function startQrScanner() {
  if (html5QrCode) return;
  html5QrCode = new Html5Qrcode('qrReader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 220, height: 220 } },
    (decodedText) => {
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.type === 'HEJCU_AUTH_QR') {
          loginWithMockQr(parsed.token);
          stopQrScanner();
        }
      } catch (e) {
        loginWithMockQr(decodedText);
        stopQrScanner();
      }
    },
    (error) => {}
  ).catch(err => {
    document.getElementById('qrFeedback').textContent = 'No se pudo acceder a la cámara. Usa la credencial digital simulada abajo.';
    document.getElementById('qrFeedback').className = 'mt-3 text-xs font-semibold text-amber-600 block';
  });
}

function stopQrScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      html5QrCode = null;
    }).catch(() => { html5QrCode = null; });
  }
}

function completeLogin(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('hejcu_token', token);
  localStorage.setItem('hejcu_user', JSON.stringify(user));

  document.getElementById('authScreen').classList.add('hidden');
  stopQrScanner();
  setupSessionUI();
}

function logout() {
  localStorage.removeItem('hejcu_token');
  localStorage.removeItem('hejcu_user');
  window.location.reload();
}

function setupSessionUI() {
  document.getElementById('navUserName').textContent = currentUser.nombreCompleto;
  document.getElementById('navUserRole').textContent = currentUser.rol.replace('_', ' ');

  // Cargar módulos
  loadDashboardData();
  loadPatients();
  loadRecords();
  loadUsers();
  loadAlerts();
}

// --------------------------------------------------------------
// CAMBIO DE MÓDULOS DE NAVEGACIÓN
// --------------------------------------------------------------
function showModule(modName) {
  ['dashboard', 'data', 'informe', 'reportes', 'seguridad'].forEach(m => {
    const el = document.getElementById('mod-' + m);
    const btn = document.getElementById('btnNav-' + m);
    if (m === modName) {
      el.classList.remove('hidden');
      btn.className = 'px-3 py-2 rounded-md bg-blue-800 text-white transition flex items-center gap-2 font-bold';
    } else {
      el.classList.add('hidden');
      btn.className = 'px-3 py-2 rounded-md text-blue-200 hover:bg-blue-800 hover:text-white transition flex items-center gap-2';
    }
  });

  if (modName === 'dashboard') {
    loadDashboardData();
  }
}

// --------------------------------------------------------------
// MÓDULO 1: DASHBOARD & INDICADORES DE DECISIÓN
// --------------------------------------------------------------
async function loadDashboardData() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();

    document.getElementById('kpiTotalAtenciones').textContent = data.totalAtenciones;
    document.getElementById('kpiTotalPacientes').textContent = data.totalPacientes;
    document.getElementById('kpiExoneraciones').textContent = data.exoneracionesCount;
    document.getElementById('kpiCasosCriticos').textContent = data.nnCount;

    renderCharts(data);
  } catch (e) {
    console.error('Error cargando métricas', e);
  }
}

function renderCharts(data) {
  // 1. Especialidad
  if (chartEspInstance) chartEspInstance.destroy();
  const ctxEsp = document.getElementById('chartEspecialidad').getContext('2d');
  chartEspInstance = new Chart(ctxEsp, {
    type: 'doughnut',
    data: {
      labels: Object.keys(data.especialidadStats),
      datasets: [{
        data: Object.values(data.especialidadStats),
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 2. Condición N / R / C
  if (chartCondInstance) chartCondInstance.destroy();
  const ctxCond = document.getElementById('chartCondicion').getContext('2d');
  chartCondInstance = new Chart(ctxCond, {
    type: 'pie',
    data: {
      labels: ['Nuevo (N)', 'Reingresante (R)', 'Continuador (C)'],
      datasets: [{
        data: [data.condicionStats.N, data.condicionStats.R, data.condicionStats.C],
        backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 3. Régimen de Aseguramiento
  if (chartSegInstance) chartSegInstance.destroy();
  const ctxSeg = document.getElementById('chartSeguros').getContext('2d');
  chartSegInstance = new Chart(ctxSeg, {
    type: 'bar',
    data: {
      labels: Object.keys(data.seguroStats),
      datasets: [{
        label: 'N° de Pacientes',
        data: Object.values(data.seguroStats),
        backgroundColor: '#4f46e5',
        borderRadius: 6
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  // 4. Problemáticas Sociales
  if (chartProbInstance) chartProbInstance.destroy();
  const ctxProb = document.getElementById('chartProblematica').getContext('2d');
  const probLabels = ['Salud Alto Riesgo', 'Abandono/Familiar', 'Vivienda', 'Legal', 'Trabajo', 'Salud Mental', 'Educativo', 'N.N. Indigente'];
  const probVals = [
    data.problematicaStats.saludAltoRiesgo,
    data.problematicaStats.familiar,
    data.problematicaStats.vivienda,
    data.problematicaStats.legal,
    data.problematicaStats.trabajo,
    data.problematicaStats.saludMental,
    data.problematicaStats.educativo,
    data.problematicaStats.nn
  ];

  chartProbInstance = new Chart(ctxProb, {
    type: 'bar',
    data: {
      labels: probLabels,
      datasets: [{
        label: 'Casos Sociales Detectados',
        data: probVals,
        backgroundColor: '#9333ea',
        borderRadius: 6
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// --------------------------------------------------------------
// MÓDULO 2: MAESTRO DE PACIENTES (HOJA "DATA")
// --------------------------------------------------------------
async function loadPatients() {
  const res = await fetch('/api/patients');
  allPatients = await res.json();
  renderPatientsTable(allPatients);
  populatePatientSelect(allPatients);
}

function renderPatientsTable(list) {
  const tbody = document.getElementById('patientsTableBody');
  tbody.innerHTML = list.map(p => {
    let condBadge = 'bg-blue-100 text-blue-800';
    let condLabel = 'N - Nuevo';
    if (p.condicion === 'R') { condBadge = 'bg-purple-100 text-purple-800'; condLabel = 'R - Reingresante'; }
    if (p.condicion === 'C') { condBadge = 'bg-emerald-100 text-emerald-800'; condLabel = 'C - Continuador'; }

    return `
      <tr class="hover:bg-slate-50 transition ${p.esNN ? 'bg-red-50/50' : ''}">
        <td class="p-3 font-mono font-bold">${p.docId || '<span class="text-red-600 font-bold">N.N.</span>'}</td>
        <td class="p-3 font-semibold text-slate-800">${p.nombres}</td>
        <td class="p-3">${p.pais}</td>
        <td class="p-3">${p.edad} años / ${p.sexo.charAt(0)}</td>
        <td class="p-3">${p.grupoEtareo}</td>
        <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${condBadge}">${condLabel}</span></td>
        <td class="p-3"><span class="font-semibold text-blue-900">${p.seguro}</span></td>
        <td class="p-3 text-center">
          <button onclick="quickRegisterRecordForPatient('${p.id}')" class="px-2 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded font-bold transition text-[11px]" title="Crear Ficha de Atención">
            <i class="fa-solid fa-file-medical"></i> Atender
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterPatients() {
  const query = document.getElementById('patientSearchInput').value.toLowerCase();
  const cond = document.getElementById('patientConditionFilter').value;
  const ins = document.getElementById('patientInsuranceFilter').value;

  const filtered = allPatients.filter(p => {
    const matchQ = p.nombres.toLowerCase().includes(query) || p.docId.toLowerCase().includes(query);
    const matchC = (cond === 'TODOS' || p.condicion === cond);
    const matchI = (ins === 'TODOS' || p.seguro === ins);
    return matchQ && matchC && matchI;
  });

  renderPatientsTable(filtered);
}

function openPatientModal() { document.getElementById('patientModal').classList.remove('hidden'); }
function closePatientModal() { document.getElementById('patientModal').classList.add('hidden'); }

async function handleSavePatient(e) {
  e.preventDefault();
  const patient = {
    docId: document.getElementById('mPatDocId').value.trim(),
    nombres: document.getElementById('mPatNombres').value.trim().toUpperCase(),
    pais: document.getElementById('mPatPais').value.trim().toUpperCase(),
    edad: parseInt(document.getElementById('mPatEdad').value) || 0,
    sexo: document.getElementById('mPatSexo').value,
    condicion: document.getElementById('mPatCondicion').value,
    seguro: document.getElementById('mPatSeguro').value,
    esNN: document.getElementById('mPatEsNN').checked
  };

  const res = await fetch('/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patient)
  });
  if (res.ok) {
    closePatientModal();
    loadPatients();
    loadDashboardData();
    loadAlerts();
  }
}

// --------------------------------------------------------------
// MÓDULO 3: CONTROL ASISTENCIAL (INFORME 2 / 3)
// --------------------------------------------------------------
async function loadRecords() {
  const res = await fetch('/api/records');
  allRecords = await res.json();
  renderRecordsTable(allRecords);
}

function renderRecordsTable(list) {
  const tbody = document.getElementById('recordsTableBody');
  tbody.innerHTML = list.map(r => {
    // Badges de acciones
    const acts = [];
    if (r.acciones?.evaluacion) acts.push('Eval');
    if (r.acciones?.entrevista) acts.push('Entrev');
    if (r.acciones?.coordInt) acts.push('Coord.Int');
    if (r.acciones?.orientacion) acts.push('Orient');
    if (r.acciones?.exoTotal) acts.push('Exo.Total');
    if (r.acciones?.exoParcial) acts.push('Exo.Parcial');

    // Problemáticas
    const probs = [];
    if (r.problematica?.saludAltoRiesgo) probs.push('Alto Riesgo');
    if (r.problematica?.familiar) probs.push('Familiar');
    if (r.problematica?.nn) probs.push('N.N/Indigente');
    if (r.problematica?.vivienda) probs.push('Vivienda');

    return `
      <tr class="hover:bg-slate-50 transition ${r.fallecido ? 'bg-red-100/60 font-semibold' : ''}">
        <td class="p-3 font-mono font-bold">${r.numero}</td>
        <td class="p-3 whitespace-nowrap">${r.fecha}</td>
        <td class="p-3 font-semibold text-slate-800">${r.nombres} <br><span class="text-[10px] text-slate-500 font-mono">${r.docId}</span></td>
        <td class="p-3"><span class="font-bold text-blue-900">${r.area}</span> <br><span class="text-[11px] text-indigo-700">${r.especialidad}</span></td>
        <td class="p-3 uppercase font-semibold text-slate-700">${r.diagnostico}</td>
        <td class="p-3"><span class="text-[11px] text-emerald-800 font-semibold">${acts.join(', ') || 'Atención estándar'}</span></td>
        <td class="p-3"><span class="text-[11px] font-bold text-purple-700">${probs.join(', ') || 'Ninguna'}</span></td>
        <td class="p-3 font-semibold text-blue-950">${r.seguro}</td>
        <td class="p-3 text-center">
          <span class="inline-block p-1 bg-slate-100 rounded text-slate-600"><i class="fa-solid fa-check"></i></span>
        </td>
      </tr>
    `;
  }).join('');
}

function filterRecords() {
  const area = document.getElementById('recordAreaFilter').value;
  const esp = document.getElementById('recordSpecialtyFilter').value;

  const filtered = allRecords.filter(r => {
    const matchA = (area === 'TODOS' || r.area === area);
    const matchE = (esp === 'TODOS' || r.especialidad === esp);
    return matchA && matchE;
  });

  renderRecordsTable(filtered);
}

function populatePatientSelect(patients) {
  const sel = document.getElementById('mRecPatientSelect');
  sel.innerHTML = '<option value="">-- Seleccionar Paciente de la Hoja DATA --</option>' +
    patients.map(p => `<option value="${p.id}">${p.docId} - ${p.nombres} (${p.seguro})</option>`).join('');
}

function fillPatientDataInRecord(patientId) {
  const patient = allPatients.find(p => p.id === patientId);
  if (!patient) return;
  document.getElementById('mRecDiagnostico').focus();
}

function quickRegisterRecordForPatient(patientId) {
  openRecordModal();
  document.getElementById('mRecPatientSelect').value = patientId;
  fillPatientDataInRecord(patientId);
}

function openRecordModal() { document.getElementById('recordModal').classList.remove('hidden'); }
function closeRecordModal() { document.getElementById('recordModal').classList.add('hidden'); }

async function handleSaveRecord(e) {
  e.preventDefault();
  const patId = document.getElementById('mRecPatientSelect').value;
  const pat = allPatients.find(p => p.id === patId);
  if (!pat) return alert('Selecciona un paciente válido');

  const record = {
    patientId: pat.id,
    docId: pat.docId,
    nombres: pat.nombres,
    pais: pat.pais,
    edad: pat.edad,
    sexo: pat.sexo,
    condicion: pat.condicion,
    seguro: pat.seguro,
    area: document.getElementById('mRecArea').value,
    especialidad: document.getElementById('mRecEspecialidad').value,
    diagnostico: document.getElementById('mRecDiagnostico').value.trim().toUpperCase(),
    acciones: {
      evaluacion: document.getElementById('mRecActEval').checked,
      entrevista: document.getElementById('mRecActEntrev').checked,
      coordInt: document.getElementById('mRecActCoordInt').checked,
      coordExt: document.getElementById('mRecActCoordExt').checked,
      orientacion: document.getElementById('mRecActOrient').checked,
      seguimiento: document.getElementById('mRecActSeguim').checked,
      exoTotal: document.getElementById('mRecActExoTot').checked,
      exoParcial: document.getElementById('mRecActExoParc').checked,
      altas: document.getElementById('mRecActAltas').checked
    },
    problematica: {
      saludAltoRiesgo: document.getElementById('mRecProbRiesgo').checked,
      familiar: document.getElementById('mRecProbFamiliar').checked,
      vivienda: document.getElementById('mRecProbVivienda').checked,
      legal: document.getElementById('mRecProbLegal').checked,
      saludMental: document.getElementById('mRecProbMental').checked,
      nn: document.getElementById('mRecProbNN').checked
    }
  };

  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  });
  if (res.ok) {
    closeRecordModal();
    loadRecords();
    loadDashboardData();
    loadAlerts();
  }
}

// --------------------------------------------------------------
// MÓDULO 4: REPORTES EXCEL Y PDF MEMBRETADOS
// --------------------------------------------------------------
function exportToExcel() {
  // Hoja 1: Ficha Social (Informe 2/3)
  const dataExport = allRecords.map(r => ({
    "N°": r.numero,
    "FECHA": r.fecha,
    "DOC. ID": r.docId,
    "APELLIDOS Y NOMBRES": r.nombres,
    "PAIS": r.pais,
    "EDAD": r.edad,
    "SEXO": r.sexo,
    "CONDICION": r.condicion,
    "AREA": r.area,
    "ESPECIALIDAD": r.especialidad,
    "SEGURO": r.seguro,
    "DIAGNOSTICO": r.diagnostico,
    "EVALUACION": r.acciones?.evaluacion ? 1 : 0,
    "ENTREVISTA": r.acciones?.entrevista ? 1 : 0,
    "COORD. INTERNA": r.acciones?.coordInt ? 1 : 0,
    "COORD. EXTERNA": r.acciones?.coordExt ? 1 : 0,
    "ORIENTACION": r.acciones?.orientacion ? 1 : 0,
    "EXO. TOTAL": r.acciones?.exoTotal ? 1 : 0,
    "EXO. PARCIAL": r.acciones?.exoParcial ? 1 : 0,
    "PROBLEMATICA NN": r.problematica?.nn ? 1 : 0,
    "SALUD ALTO RIESGO": r.problematica?.saludAltoRiesgo ? 1 : 0,
    "RESPONSABLE": r.responsable || "Lic. Milagritos Taravay"
  }));

  // Hoja 2: Maestro DATA
  const dataPacientes = allPatients.map(p => ({
    "DOC. ID": p.docId,
    "APELLIDOS Y NOMBRES": p.nombres,
    "PAIS": p.pais,
    "EDAD": p.edad,
    "SEXO": p.sexo,
    "GRUPO ETAREO": p.grupoEtareo,
    "CONDICION (N/R/C)": p.condicion,
    "SEGURO": p.seguro,
    "FECHA REGISTRO": p.createdAt
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(dataExport);
  const ws2 = XLSX.utils.json_to_sheet(dataPacientes);

  XLSX.utils.book_append_sheet(wb, ws1, "INFORME_ESTADISTICO");
  XLSX.utils.book_append_sheet(wb, ws2, "HOJA_DATA_PACIENTES");

  XLSX.writeFile(wb, `HEJCU_Servicio_Social_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  // Encabezado Membretado Oficial
  doc.setFillColor(0, 75, 135);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('HOSPITAL DE EMERGENCIAS "JOSÉ CASIMIRO ULLOA"', 105, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DEPARTAMENTO DE SERVICIO SOCIAL - REPORTE ASISTENCIAL OFICIAL (MINSA / ESSALUD)', 105, 17, { align: 'center' });

  // Datos Institucionales
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}`, 14, 30);
  doc.text(`Responsable de Servicio: Lic. Milagritos Taravay Nicho`, 14, 35);
  doc.text(`Total Atenciones Evaluadas: ${allRecords.length}`, 140, 30);
  doc.text(`Total Pacientes Registrados (DATA): ${allPatients.length}`, 140, 35);

  // Tabla con AutoTable
  const tableData = allRecords.slice(0, 35).map(r => [
    r.numero,
    r.fecha,
    r.docId,
    r.nombres.substring(0, 24),
    r.area.substring(0, 8),
    r.especialidad.substring(0, 10),
    r.diagnostico.substring(0, 18),
    r.seguro
  ]);

  doc.autoTable({
    startY: 42,
    head: [['N°', 'Fecha', 'Doc. ID', 'Paciente', 'Área', 'Especialidad', 'Diagnóstico', 'Seguro']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [0, 75, 135], textColor: 255, fontStyle: 'bold' }
  });

  // Pie de Firma
  const finalY = doc.lastAutoTable.finalY + 25;
  if (finalY < 260) {
    doc.line(25, finalY, 85, finalY);
    doc.line(125, finalY, 185, finalY);
    doc.setFontSize(8);
    doc.text('Lic. Milagritos Taravay Nicho\nTrabajadora Social de Turno', 55, finalY + 5, { align: 'center' });
    doc.text('Dirección Médica / Jefatura\nHospital de Emergencias José Casimiro Ulloa', 155, finalY + 5, { align: 'center' });
  }

  doc.save(`Reporte_Servicio_Social_HEJCU_${new Date().toISOString().slice(0,10)}.pdf`);
}

// --------------------------------------------------------------
// MÓDULO 5: USUARIOS & CIBERSEGURIDAD
// --------------------------------------------------------------
async function loadUsers() {
  const res = await fetch('/api/users');
  allUsers = await res.json();
  renderUsersTable(allUsers);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = users.map(u => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3 font-bold font-mono text-blue-900">${u.username}</td>
      <td class="p-3 font-semibold text-slate-800">${u.nombreCompleto}</td>
      <td class="p-3 text-slate-600">${u.email}</td>
      <td class="p-3 font-bold text-xs"><span class="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">${u.rol}</span></td>
      <td class="p-3 text-center"><span class="text-emerald-600 font-bold"><i class="fa-solid fa-shield-check"></i> Activo</span></td>
      <td class="p-3 text-center">
        <button onclick="showUserQr('${u.username}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 font-bold transition text-xs">
          <i class="fa-solid fa-qrcode"></i> Ver QR
        </button>
      </td>
      <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">${u.estado}</span></td>
      <td class="p-3 text-slate-500">${u.ultimoAcceso}</td>
    </tr>
  `).join('');
}

async function showUserQr(username) {
  const res = await fetch(`/api/auth/qr-code/${username}`);
  const data = await res.json();

  document.getElementById('qrModalTitle').textContent = `Credencial QR: ${username}`;
  document.getElementById('qrModalUser').textContent = `Token Digital: ${data.qrLoginToken}`;
  document.getElementById('qrModalImg').src = data.qrImageUrl;
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() { document.getElementById('qrModal').classList.add('hidden'); }
function openUserModal() { document.getElementById('userModal').classList.remove('hidden'); }
function closeUserModal() { document.getElementById('userModal').classList.add('hidden'); }

async function handleSaveUser(e) {
  e.preventDefault();
  const user = {
    username: document.getElementById('mUserUsername').value.trim(),
    nombreCompleto: document.getElementById('mUserNombre').value.trim(),
    email: document.getElementById('mUserEmail').value.trim(),
    rol: document.getElementById('mUserRol').value,
    password: document.getElementById('mUserPassword').value
  };

  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  if (res.ok) {
    closeUserModal();
    loadUsers();
  } else {
    const err = await res.json();
    alert(err.message || 'Error al crear usuario');
  }
}

// --------------------------------------------------------------
// ALERTAS HOSPITALARIAS
// --------------------------------------------------------------
async function loadAlerts() {
  const res = await fetch('/api/alerts');
  allAlerts = await res.json();
  document.getElementById('alertsBadge').textContent = allAlerts.length;

  const list = document.getElementById('alertsList');
  if (allAlerts.length === 0) {
    list.innerHTML = '<p class="text-center text-xs text-slate-400 py-6">No hay alertas activas en este momento.</p>';
    return;
  }

  list.innerHTML = allAlerts.map(a => `
    <div class="p-3 rounded-lg border-l-4 ${a.tipo.includes('CRITICA') || a.tipo === 'FALLECIMIENTO' ? 'border-red-600 bg-red-50/70' : 'border-amber-500 bg-amber-50/70'} space-y-1">
      <div class="flex justify-between items-center text-xs font-bold ${a.tipo.includes('CRITICA') ? 'text-red-900' : 'text-amber-900'}">
        <span>${a.titulo}</span>
        <span class="text-[10px] font-normal text-slate-500">${a.fecha}</span>
      </div>
      <p class="text-xs text-slate-700">${a.mensaje}</p>
      ${a.destinatario ? `<p class="text-[10px] text-blue-700 font-semibold"><i class="fa-solid fa-paper-plane"></i> Notificado a: ${a.destinatario}</p>` : ''}
    </div>
  `).join('');
}

function toggleAlertsModal() {
  document.getElementById('alertsModal').classList.toggle('hidden');
}

async function handleTestEmail(e) {
  e.preventDefault();
  const email = document.getElementById('testEmailInput').value;
  const asunto = document.getElementById('testAsuntoInput').value;
  const fb = document.getElementById('emailFeedback');

  fb.textContent = 'Enviando alerta...';
  fb.className = 'mt-3 text-xs font-semibold text-blue-700 block';

  try {
    const res = await fetch('/api/alerts/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, asunto })
    });
    const data = await res.json();
    fb.textContent = '✅ ' + data.message;
    fb.className = 'mt-3 text-xs font-semibold text-emerald-600 block';
    loadAlerts();
  } catch (err) {
    fb.textContent = '❌ Error al remitir correo';
    fb.className = 'mt-3 text-xs font-semibold text-red-600 block';
  }
}
