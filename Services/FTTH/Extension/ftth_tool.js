// ==UserScript==
// @name         FTTH Customer Info Tool - Ultimate Pro
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  نظام نسخ متطور مع تحديث إجباري وفحص أونلاين وحفظ إعدادات منفصلة
// @author       Gemini
// @match        https://admin.ftth.iq/customer-details/*/details/view*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/Extension/ftth_tool.js
// @downloadURL  https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/Extension/ftth_tool.js
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. الإعدادات والروابط المباشرة
    // ==========================================
    const CURRENT_VERSION = "1.7";
    const VERSION_URL = "https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/Extension/version.json";
    const EXENABLE_URL = "https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/exenable.txt";

    // ==========================================
    // 2. متغيرات الحالة (State)
    // ==========================================
    let isScriptEnabled = true;     
    let isUpdateRequired = false;    
    let updateUrl = "";             
    let latestVersionStr = "";      

    // ==========================================
    // 3. قاعدة البيانات IndexedDB
    // ==========================================
    const DB_NAME = 'FTTHToolDB_Final';
    const STORE_NAME = 'UserPreferences';

    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveSettings(settings) {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(settings, 'config');
    }

    async function loadSettings() {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get('config');
            request.onsuccess = () => resolve(request.result || defaultSettings);
        });
    }

    // ==========================================
    // 4. منطق التحديث والفحص (عند التحميل)
    // ==========================================
    async function performStartupChecks() {
        // فحص الصلاحية العامة
        try {
            const resEnable = await fetch(EXENABLE_URL);
            const textEnable = await resEnable.text();
            if (textEnable.trim() !== '1') isScriptEnabled = false;
        } catch (e) { console.error("Exenable check failed"); }

        // فحص إصدار السكربت
        try {
            const resVer = await fetch(VERSION_URL + "?t=" + Date.now()); 
            const dataVer = await resVer.json();
            if (dataVer.version !== CURRENT_VERSION) {
                isUpdateRequired = true;
                updateUrl = dataVer.downloadUrl;
                latestVersionStr = dataVer.version;
            }
        } catch (e) { console.error("Version check failed"); }
    }

    // ==========================================
    // 5. واجهة المستخدم (CSS والأزرار)
    // ==========================================
    const defaultSettings = {
        maintenanceFields: { name: true, phone: true, contract_id: true, username: true, serial: true, zone: true, fat: true, status: true, ip: true, session_start: true, expiry: true, sub_status: true, sub_type: true, sub_period: true, password: true, power: true },
        deliveryFields: { name: true, phone: true, contract_id: true, username: true, serial: true, zone: true, fat: true, status: true, ip: true, session_start: true, expiry: true, sub_status: true, sub_type: true, sub_period: true, password: true, power: true },
        maintenancePrompts: { altPhone: true, problemDesc: true },
        deliveryPrompts: { altPhone: true, note: true }
    };
    let settings = defaultSettings;

    const style = document.createElement('style');
    style.innerHTML = `
        .ftth-btn { position: fixed; bottom: 20px; z-index: 9999; color: white; border: none; width: 55px; height: 55px; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; transition: transform 0.2s; }
        #ftth-maint-btn { right: 85px; background: #2196F3; }
        #ftth-deliv-btn { right: 20px; background: #FF9800; }
        .ftth-btn:hover { transform: scale(1.1); }
        #ftth-settings-btn { position: fixed; top: 10px; right: 10px; z-index: 9999; background: rgba(0,0,0,0.2); color: white; border: none; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        #ftth-panel { position: fixed; top: 40px; right: 10px; z-index: 10000; background: white; border: 1px solid #ccc; padding: 15px; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.2); display: none; max-height: 85vh; overflow-y: auto; width: 280px; direction: rtl; font-family: sans-serif; }
        .section-title { font-weight: bold; color: #2196F3; margin: 10px 0; border-bottom: 2px solid #eee; font-size: 14px; }
        .s-item { margin-bottom: 5px; font-size: 12px; display: flex; align-items: center; }
        .s-item input { margin-left: 8px; }
        .toast-info { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10001; display: none; }
        .hide-pop { opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; }
    `;
    document.head.appendChild(style);

    const maintBtn = document.createElement('button'); maintBtn.id = 'ftth-maint-btn'; maintBtn.className = 'ftth-btn'; maintBtn.innerHTML = '🛠️';
    const delivBtn = document.createElement('button'); delivBtn.id = 'ftth-deliv-btn'; delivBtn.className = 'ftth-btn'; delivBtn.innerHTML = '🚚';
    const setBtn = document.createElement('button'); setBtn.id = 'ftth-settings-btn'; setBtn.innerHTML = '⚙️';
    const panel = document.createElement('div'); panel.id = 'ftth-panel';
    const toast = document.createElement('div'); toast.className = 'toast-info';
    document.body.appendChild(toast);

    function showT(m) { toast.innerText = m; toast.style.display = 'block'; setTimeout(() => { toast.style.display = 'none'; }, 2000); }

    const labels = { name: "الاسم", phone: "الهاتف", contract_id: "بطاقة التعريف", username: "اليوزر", serial: "السيريال", zone: "الزون", fat: "الفات", status: "الجلسة", ip: "الأيبي", session_start: "البداية", expiry: "الانتهاء", sub_status: "الحالة", sub_type: "النوع", sub_period: "المدة", password: "الباسورد", power: "الباور" };

    function drawSettings() {
        let h = '<div style="text-align:center;font-weight:bold;margin-bottom:10px;">الإعدادات</div>';
        h += '<div class="section-title">🛠️ الصيانة:</div>';
        for (const k in settings.maintenanceFields) h += `<div class="s-item"><input type="checkbox" id="m_${k}" ${settings.maintenanceFields[k] ? 'checked' : ''}> ${labels[k]}</div>`;
        h += `<div class="s-item" style="background:#f0f7ff;"><input type="checkbox" id="m_p_alt" ${settings.maintenancePrompts.altPhone ? 'checked' : ''}> هاتف بديل</div>`;
        h += `<div class="s-item" style="background:#f0f7ff;"><input type="checkbox" id="m_p_prob" ${settings.maintenancePrompts.problemDesc ? 'checked' : ''}> وصف مشكلة</div>`;
        h += '<div class="section-title">🚚 الدلفري:</div>';
        for (const k in settings.deliveryFields) h += `<div class="s-item"><input type="checkbox" id="d_${k}" ${settings.deliveryFields[k] ? 'checked' : ''}> ${labels[k]}</div>`;
        h += `<div class="s-item" style="background:#fff8f0;"><input type="checkbox" id="d_p_alt" ${settings.deliveryPrompts.altPhone ? 'checked' : ''}> هاتف بديل</div>`;
        h += `<div class="s-item" style="background:#fff8f0;"><input type="checkbox" id="d_p_note" ${settings.deliveryPrompts.note ? 'checked' : ''}> ملاحظة</div>`;
        h += '<br><button id="btn-save" style="width:100%;padding:8px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;">حفظ</button>';
        panel.innerHTML = h;
        document.getElementById('btn-save').onclick = async () => {
            for (const k in settings.maintenanceFields) settings.maintenanceFields[k] = document.getElementById(`m_${k}`).checked;
            settings.maintenancePrompts.altPhone = document.getElementById('m_p_alt').checked;
            settings.maintenancePrompts.problemDesc = document.getElementById('m_p_prob').checked;
            for (const k in settings.deliveryFields) settings.deliveryFields[k] = document.getElementById(`d_${k}`).checked;
            settings.deliveryPrompts.altPhone = document.getElementById('d_p_alt').checked;
            settings.deliveryPrompts.note = document.getElementById('d_p_note').checked;
            await saveSettings(settings); panel.style.display = 'none'; showT('تم الحفظ');
        };
    }

    async function collect(type) {
        if (!isScriptEnabled) { alert("⚠️ الإضافة معطلة حالياً."); return; }

        if (isUpdateRequired) {
            if (confirm(`⚠️ نسخة قديمة (${CURRENT_VERSION})!\nيتوفر إصدار جديد (${latestVersionStr}).\n\nهل تريد التحديث الآن؟`)) {
                window.open(updateUrl, '_blank');
            }
            return;
        }

        const data = {};
        const fields = type === 'maintenance' ? settings.maintenanceFields : settings.deliveryFields;
        const prompts = type === 'maintenance' ? settings.maintenancePrompts : settings.deliveryPrompts;
        const getT = (s) => { let e = document.querySelector(s); return e ? e.innerText.trim() : null; };

        if (fields.name) data.name = getT('#customer-details-nav-cst-name-header');
        if (fields.phone) { let l = Array.from(document.querySelectorAll('.label.value.ng-star-inserted')); data.phone = l.find(e => /\d{10,}/.test(e.innerText))?.innerText.trim() || null; }
        if (fields.contract_id) data.contract_id = getT('[data-test-id="sub-list-item-contract-id-0"]');
        if (fields.username) data.username = getT('[data-test-id="sub-list-item-device-username-0"]');
        if (fields.serial) data.serial = getT('[data-test-id="sub-list-item-device-ont-serial-0"]');
        if (fields.zone) data.zone = getT('[data-test-id="sub-list-item-fdt-0"]');
        if (fields.fat) data.fat = getT('[data-test-id="sub-list-item-fat-0"]');
        if (fields.status) data.status = getT('[data-test-id="sub-list-item-session-status-0"]');
        if (fields.ip) data.ip = getT('[data-test-id="sub-list-item-ip-address-0"]');
        if (fields.session_start) data.session_start = getT('[data-test-id="sub-list-item-start-time-0"]');
        if (fields.expiry) data.expiry = getT('[data-test-id="sub-list-item-expire-date-0"]');
        if (fields.sub_status) data.sub_status = getT('[data-test-id="sub-list-item-status-0"]');
        if (fields.sub_type) data.sub_type = getT('[data-test-id="sub-list-item-services-0_0"]');
        if (fields.sub_period) data.sub_period = getT('[data-test-id="sub-list-item-commitment-period-0"]');

        if (prompts.altPhone) { let a = prompt("رقم الهاتف البديل؟"); if (a) data.altPhone = a; }
        if (type === 'maintenance' && prompts.problemDesc) { let d = prompt("مشكلة اليوزر؟"); if (d) data.problemDesc = d; }
        if (type === 'delivery' && prompts.note) { let n = prompt("ملاحظة الدلفري؟"); if (n) data.note = n; }

        if (fields.password || fields.power) {
            showT('جاري جلب البيانات الفنية...');
            document.querySelector('[data-test-id="sub-list-item-btn-technical-details-0"]')?.click();
            let att = 0;
            while (att < 20) {
                await new Promise(r => setTimeout(r, 400));
                document.querySelector('.cdk-overlay-container')?.classList.add('hide-pop');
                let pI = document.querySelector('[data-test-id="technical-details-device-password"]');
                let wI = document.querySelector('[data-test-id="technical-details-ont-power"]');
                if (fields.password && pI?.value) data.password = pI.value;
                if (fields.power && wI?.value && !wI.value.toLowerCase().includes('loading')) data.power = wI.value;
                if ((!fields.password || data.password) && (!fields.power || data.power)) break;
                att++;
            }
            document.querySelector('button[mat-dialog-close]')?.click();
            document.querySelector('.cdk-overlay-container')?.classList.remove('hide-pop');
        }

        let head = type === 'maintenance' ? '🛠️ صيانة' : '🚚 دلفري';
        let msg = `📋 ${head}\n----------------------------\n`;
        if (data.name) msg += `👤 الاسم: ${data.name}\n`;
        if (data.phone) msg += `📞 الهاتف: ${data.phone}\n`;
        if (data.altPhone) msg += `📱 البديل: ${data.altPhone}\n`;
        if (data.contract_id) msg += `💳 بطاقة التعريف: ${data.contract_id}\n`;
        if (data.username) msg += `🆔 اليوزر: ${data.username}\n`;
        if (data.password) msg += `🔑 الباسورد: ${data.password}\n`;
        if (data.serial) msg += `🔢 السيريال: ${data.serial}\n`;
        if (data.power) msg += `⚡ الباور: ${data.power}\n`;
        if (data.zone) msg += `📍 الزون: ${data.zone}\n`;
        if (data.fat) msg += `🏗️ الفات: ${data.fat}\n`;
        if (data.status) msg += `🌐 الجلسة: ${data.status}\n`;
        if (data.ip) msg += `💻 الأيبي: ${data.ip}\n`;
        if (data.session_start) msg += `⏳ البداية: ${data.session_start}\n`;
        if (data.expiry) msg += `📅 الانتهاء: ${data.expiry}\n`;
        if (data.sub_status) msg += `✅ الحالة: ${data.sub_status}\n`;
        if (data.sub_type) msg += `📦 النوع: ${data.sub_type}\n`;
        if (data.sub_period) msg += `🗓️ المدة: ${data.sub_period}\n`;
        if (data.problemDesc) msg += `📝 المشكلة: ${data.problemDesc}\n`;
        if (data.note) msg += `📝 ملاحظة: ${data.note}\n`;
        msg += `----------------------------`;

        GM_setClipboard(msg.split('\n').filter(l => !l.includes(': null')).join('\n'));
        showT('✅ تم النسخ');
    }

    window.addEventListener('load', async () => {
        performStartupChecks(); 
        settings = await loadSettings();
        document.body.append(maintBtn, delivBtn, setBtn, panel);
        setBtn.onclick = (e) => { e.stopPropagation(); panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; if (panel.style.display === 'block') drawSettings(); };
        maintBtn.onclick = () => collect('maintenance');
        delivBtn.onclick = () => collect('delivery');
        document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== setBtn) panel.style.display = 'none'; });
    });

})();
