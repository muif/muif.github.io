// ==UserScript==
// @name         نسخ معلومات المشتركين V2
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  نظام نسخ متطور بواسطة منتظر عماد
// @author       Muntadher Imad ✅
// @match        https://admin.ftth.iq/customer-details/*/details/view*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/Extension/ftth_tool.user.js
// @downloadURL  https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/Extension/ftth_tool.user.js
// ==/UserScript==


(function() {
    'use strict';

    // ==========================================
    // 1. الإعدادات والروابط
    // ==========================================
    const CURRENT_VERSION = "2.0";
    const VERSION_URL = "https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/Extension/version.json";
    const EXENABLE_URL = "https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/exenable.txt";

    let isScriptEnabled = true;     
    let isUpdateRequired = false;    
    let updateUrl = "";             
    let latestVersionStr = "";      

    // ==========================================
    // 2. قاعدة البيانات IndexedDB
    // ==========================================
    const DB_NAME = 'FTTHToolDB_Final_V3';
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
    // 3. منطق التحديث والفحص
    // ==========================================
    async function performStartupChecks() {
        try {
            const resEnable = await fetch(EXENABLE_URL);
            const textEnable = await resEnable.text();
            if (textEnable.trim() !== '1') isScriptEnabled = false;
        } catch (e) { console.error("Exenable check failed"); }

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
    // 4. واجهة المستخدم (CSS والأزرار)
    // ==========================================
    const defaultSettings = {
        maintenanceFields: { name: true, phone: true, contract_id: true, username: true, serial: true, zone: true, fat: true, status: true, ip: true, session_start: true, expiry: true, sub_status: true, sub_type: true, sub_period: true, password: true, power: true },
        deliveryFields: { name: true, phone: true, contract_id: true, username: true, serial: true, zone: true, fat: true, status: true, ip: true, session_start: true, expiry: true, sub_status: true, sub_type: true, sub_period: true, password: true, power: true },
        maintenancePrompts: { altPhone: true, problemDesc: true },
        deliveryPrompts: { altPhone: true, note: true },
        positions: { 
            maint: { bottom: 20, right: 85 }, 
            deliv: { bottom: 20, right: 20 } 
        },
        sizes: {
            maint: 55,
            deliv: 55
        }
    };
    let settings = defaultSettings;

    const style = document.createElement('style');
    style.id = 'ftth-dynamic-style';
    document.head.appendChild(style);

    function updateBtnStyles() {
        style.innerHTML = `
            .ftth-btn { position: fixed; z-index: 9999; color: white; border: none; border-radius: 50%; cursor: grab; box-shadow: 0 6px 15px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.2s; user-select: none; touch-action: none; }
            .ftth-btn:active { cursor: grabbing; transform: scale(0.95); }
            #ftth-maint-btn { bottom: ${settings.positions.maint.bottom}px; right: ${settings.positions.maint.right}px; width: ${settings.sizes.maint}px; height: ${settings.sizes.maint}px; background: linear-gradient(135deg, #2196F3, #1976D2); font-size: ${settings.sizes.maint * 0.45}px; }
            #ftth-deliv-btn { bottom: ${settings.positions.deliv.bottom}px; right: ${settings.positions.deliv.right}px; width: ${settings.sizes.deliv}px; height: ${settings.sizes.deliv}px; background: linear-gradient(135deg, #FF9800, #F57C00); font-size: ${settings.sizes.deliv * 0.45}px; }
            .ftth-btn:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
            
            #ftth-settings-btn { position: fixed; top: 10px; right: 10px; z-index: 9999; background: rgba(0,0,0,0.2); color: white; border: none; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; backdrop-filter: blur(4px); transition: background 0.3s; }
            #ftth-settings-btn:hover { background: rgba(0,0,0,0.5); }
            
            #ftth-panel { position: fixed; top: 45px; right: 10px; z-index: 10000; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: none; flex-direction: column; width: 320px; direction: rtl; font-family: 'Segoe UI', Tahoma, sans-serif; overflow: hidden; border: 1px solid #eee; }
            
            .tabs-header { display: flex; background: #f8f9fa; border-bottom: 1px solid #eee; }
            .tab-link { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-size: 13px; font-weight: 600; color: #666; transition: all 0.3s; }
            .tab-link.active { color: #2196F3; border-bottom: 3px solid #2196F3; background: #fff; }
            
            .tabs-content { padding: 15px; max-height: 450px; overflow-y: auto; }
            .tab-pane { display: none; }
            .tab-pane.active { display: block; }
            
            .section-title { font-weight: 700; color: #333; margin: 15px 0 10px 0; font-size: 14px; display: flex; align-items: center; gap: 8px; }
            .s-item { margin-bottom: 8px; font-size: 13px; display: flex; align-items: center; color: #444; }
            .s-item input[type="checkbox"] { width: 16px; height: 16px; margin-left: 10px; cursor: pointer; }
            
            .range-container { margin: 15px 0; }
            .range-label { font-size: 12px; color: #666; margin-bottom: 5px; display: block; }
            input[type="range"] { width: 100%; cursor: pointer; }
            
            .btn-save-container { padding: 12px; background: #fff; border-top: 1px solid #eee; }
            #btn-save { width: 100%; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; transition: background 0.3s; }
            #btn-save:hover { background: #1976D2; }
            
            .toast-info { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 12px 24px; border-radius: 30px; z-index: 10001; display: none; font-size: 14px; backdrop-filter: blur(5px); }
            .hide-pop { opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; }
        `;
    }

    const maintBtn = document.createElement('button'); maintBtn.id = 'ftth-maint-btn'; maintBtn.className = 'ftth-btn'; maintBtn.innerHTML = '🛠️';
    const delivBtn = document.createElement('button'); delivBtn.id = 'ftth-deliv-btn'; delivBtn.className = 'ftth-btn'; delivBtn.innerHTML = '🚚';
    const setBtn = document.createElement('button'); setBtn.id = 'ftth-settings-btn'; setBtn.innerHTML = '⚙️';
    const panel = document.createElement('div'); panel.id = 'ftth-panel';
    const toast = document.createElement('div'); toast.className = 'toast-info';
    document.body.appendChild(toast);

    function showT(m) { toast.innerText = m; toast.style.display = 'block'; setTimeout(() => { toast.style.display = 'none'; }, 2000); }

    const labels = { name: "الاسم", phone: "الهاتف", contract_id: "بطاقة التعريف", username: "اليوزر", serial: "السيريال", zone: "الزون", fat: "الفات", status: "الجلسة", ip: "الأيبي", session_start: "البداية", expiry: "الانتهاء", sub_status: "الحالة", sub_type: "النوع", sub_period: "المدة", password: "الباسورد", power: "الباور" };

    function drawSettings() {
        let h = `
            <div class="tabs-header">
                <div class="tab-link active" data-tab="maint-tab">الصيانة</div>
                <div class="tab-link" data-tab="deliv-tab">الدلفري</div>
                <div class="tab-link" data-tab="general-tab">الإعدادات</div>
            </div>
            <div class="tabs-content">
                <div class="tab-pane active" id="maint-tab">
                    <div class="section-title">🛠️ حقول الصيانة المنسوخة</div>
                    ${Object.keys(settings.maintenanceFields).map(k => `
                        <div class="s-item"><input type="checkbox" id="m_${k}" ${settings.maintenanceFields[k] ? 'checked' : ''}> ${labels[k]}</div>
                    `).join('')}
                    <div class="section-title">⚙️ خيارات السؤال</div>
                    <div class="s-item"><input type="checkbox" id="m_p_alt" ${settings.maintenancePrompts.altPhone ? 'checked' : ''}> طلب هاتف بديل</div>
                    <div class="s-item"><input type="checkbox" id="m_p_prob" ${settings.maintenancePrompts.problemDesc ? 'checked' : ''}> طلب وصف مشكلة</div>
                </div>
                
                <div class="tab-pane" id="deliv-tab">
                    <div class="section-title" style="color:#FF9800;">🚚 حقول الدلفري المنسوخة</div>
                    ${Object.keys(settings.deliveryFields).map(k => `
                        <div class="s-item"><input type="checkbox" id="d_${k}" ${settings.deliveryFields[k] ? 'checked' : ''}> ${labels[k]}</div>
                    `).join('')}
                    <div class="section-title">⚙️ خيارات السؤال</div>
                    <div class="s-item"><input type="checkbox" id="d_p_alt" ${settings.deliveryPrompts.altPhone ? 'checked' : ''}> طلب هاتف بديل</div>
                    <div class="s-item"><input type="checkbox" id="d_p_note" ${settings.deliveryPrompts.note ? 'checked' : ''}> طلب ملاحظة</div>
                </div>
                
                <div class="tab-pane" id="general-tab">
                    <div class="section-title">📏 أحجام الأيقونات</div>
                    <div class="range-container">
                        <label class="range-label">حجم أيقونة الصيانة: <span id="val_m_size">${settings.sizes.maint}</span>px</label>
                        <input type="range" id="range_m_size" min="30" max="100" value="${settings.sizes.maint}">
                    </div>
                    <div class="range-container">
                        <label class="range-label">حجم أيقونة الدلفري: <span id="val_d_size">${settings.sizes.deliv}</span>px</label>
                        <input type="range" id="range_d_size" min="30" max="100" value="${settings.sizes.deliv}">
                    </div>
                    <p style="font-size:11px; color:#888; margin-top:10px;">* ملاحظة: يمكنك سحب الأيقونات بالماوس لتغيير مكانها في أي وقت.</p>
                </div>
            </div>
            <div class="btn-save-container">
                <button id="btn-save">حفظ جميع الإعدادات</button>
            </div>
        `;
        panel.innerHTML = h;

        // منطق التبويبات
        const tabLinks = panel.querySelectorAll('.tab-link');
        tabLinks.forEach(link => {
            link.onclick = () => {
                panel.querySelectorAll('.tab-link, .tab-pane').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                panel.querySelector(`#${link.dataset.tab}`).classList.add('active');
            };
        });

        // تحديث أرقام الأحجام مباشرة
        panel.querySelector('#range_m_size').oninput = (e) => panel.querySelector('#val_m_size').innerText = e.target.value;
        panel.querySelector('#range_d_size').oninput = (e) => panel.querySelector('#val_d_size').innerText = e.target.value;

        document.getElementById('btn-save').onclick = async () => {
            // حفظ الحقول
            for (const k in settings.maintenanceFields) settings.maintenanceFields[k] = document.getElementById(`m_${k}`).checked;
            settings.maintenancePrompts.altPhone = document.getElementById('m_p_alt').checked;
            settings.maintenancePrompts.problemDesc = document.getElementById('m_p_prob').checked;
            
            for (const k in settings.deliveryFields) settings.deliveryFields[k] = document.getElementById(`d_${k}`).checked;
            settings.deliveryPrompts.altPhone = document.getElementById('d_p_alt').checked;
            settings.deliveryPrompts.note = document.getElementById('d_p_note').checked;
            
            // حفظ الأحجام
            settings.sizes.maint = parseInt(document.getElementById('range_m_size').value);
            settings.sizes.deliv = parseInt(document.getElementById('range_d_size').value);

            await saveSettings(settings); 
            updateBtnStyles(); 
            panel.style.display = 'none'; 
            showT('✅ تم الحفظ بنجاح');
        };
    }

    // ==========================================
    // 5. منطق السحب والإفلات (Drag and Drop)
    // ==========================================
    function makeDraggable(el, type) {
        let isDragging = false;
        let startX, startY, initialRight, initialBottom;
        let moveThreshold = 5; // بكسل لتمييز السحب عن النقرة

        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag, { passive: false });

        function startDrag(e) {
            isDragging = false;
            let event = e.type === 'touchstart' ? e.touches[0] : e;
            startX = event.clientX;
            startY = event.clientY;
            initialRight = settings.positions[type].right;
            initialBottom = settings.positions[type].bottom;

            document.addEventListener('mousemove', moveDrag);
            document.addEventListener('touchmove', moveDrag, { passive: false });
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
        }

        function moveDrag(e) {
            let event = e.type === 'touchmove' ? e.touches[0] : e;
            let dx = startX - event.clientX;
            let dy = startY - event.clientY;

            if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
                isDragging = true;
                settings.positions[type].right = initialRight + dx;
                settings.positions[type].bottom = initialBottom + dy;
                updateBtnStyles();
            }
            if (e.type === 'touchmove') e.preventDefault();
        }

        function stopDrag() {
            document.removeEventListener('mousemove', moveDrag);
            document.removeEventListener('touchmove', moveDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
            
            if (isDragging) {
                saveSettings(settings);
            }
        }

        // منع النقرة إذا كان هناك سحب
        el.addEventListener('click', (e) => {
            if (isDragging) {
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }, true);
    }

    // ==========================================
    // 6. منطق النسخ والتحقق
    // ==========================================
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

        if (prompts.altPhone) { let a = prompt("رقم الهاتف البديل؟"); if (a && a.trim()) data.altPhone = a.trim(); }
        if (type === 'maintenance' && prompts.problemDesc) { let d = prompt("مشكلة اليوزر؟"); if (d && d.trim()) data.problemDesc = d.trim(); }
        if (type === 'delivery' && prompts.note) { let n = prompt("ملاحظة الدلفري؟"); if (n && n.trim()) data.note = n.trim(); }

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

        const headIcon = type === 'maintenance' ? '🛠️' : '🚚';
        let msg = `${headIcon} *${data.name}*\n----------------------------\n`;
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
        
        if (type === 'maintenance' && data.problemDesc) msg += `📝 المشكلة: *${data.problemDesc}*\n`;
        if (type === 'delivery' && data.note) msg += `📝 ملاحظة: *${data.note}*\n`;
        
        msg += `----------------------------\n`;
        msg += `📋 ${headIcon} *${type === 'maintenance' ? 'صيانة' : 'دلفري'}*`;

        GM_setClipboard(msg.split('\n').filter(l => !l.includes(': null') && !l.endsWith(': undefined')).join('\n'));
        showT('✅ تم النسخ بالتنسيق الجديد');
    }

    // ==========================================
    // 7. التشغيل الابتدائي
    // ==========================================
    window.addEventListener('load', async () => {
        performStartupChecks(); 
        settings = await loadSettings();
        updateBtnStyles(); 
        
        document.body.append(maintBtn, delivBtn, setBtn, panel);
        
        makeDraggable(maintBtn, 'maint');
        makeDraggable(delivBtn, 'deliv');

        setBtn.onclick = (e) => { e.stopPropagation(); panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; if (panel.style.display === 'flex') drawSettings(); };
        
        maintBtn.onclick = () => collect('maintenance');
        delivBtn.onclick = () => collect('delivery');
        
        document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== setBtn) panel.style.display = 'none'; });
    });

})();
