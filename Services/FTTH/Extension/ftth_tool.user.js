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
    const CURRENT_VERSION = "2.1";
    const VERSION_URL = "https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/Extension/version.json";
    const EXENABLE_URL = "https://raw.githubusercontent.com/muif/muif.github.io/refs/heads/main/Services/FTTH/exenable.txt";

    let isScriptEnabled = true;     
    let isUpdateRequired = false;    
    let updateUrl = "";             
    let latestVersionStr = "";
    let editMode = false; // وضع التحرير (داخلي)

    // ==========================================
    // 2. قاعدة البيانات IndexedDB
    // ==========================================
    const DB_NAME = 'FTTHToolDB_Final_V4';
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
        appearance: {
            maint: { size: 55, color: '#2196F3', emoji: '🛠️' },
            deliv: { size: 55, color: '#FF9800', emoji: '🚚' }
        }
    };
    let settings = defaultSettings;

    const style = document.createElement('style');
    style.id = 'ftth-dynamic-style';
    document.head.appendChild(style);

    function updateBtnStyles() {
        maintBtn.innerHTML = settings.appearance.maint.emoji;
        delivBtn.innerHTML = settings.appearance.deliv.emoji;

        style.innerHTML = `
            .ftth-btn { position: fixed; z-index: 9999; color: white; border: none; border-radius: 50%; cursor: ${editMode ? 'grab' : 'pointer'}; box-shadow: 0 6px 15px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.2s; user-select: none; touch-action: none; }
            .ftth-btn:active { cursor: ${editMode ? 'grabbing' : 'pointer'}; transform: scale(0.95); }
            
            #ftth-maint-btn { 
                bottom: ${settings.positions.maint.bottom}px; 
                right: ${settings.positions.maint.right}px; 
                width: ${settings.appearance.maint.size}px; 
                height: ${settings.appearance.maint.size}px; 
                background: ${settings.appearance.maint.color}; 
                font-size: ${settings.appearance.maint.size * 0.45}px;
                border: ${editMode ? '2px dashed #fff' : 'none'};
            }
            
            #ftth-deliv-btn { 
                bottom: ${settings.positions.deliv.bottom}px; 
                right: ${settings.positions.deliv.right}px; 
                width: ${settings.appearance.deliv.size}px; 
                height: ${settings.appearance.deliv.size}px; 
                background: ${settings.appearance.deliv.color}; 
                font-size: ${settings.appearance.deliv.size * 0.45}px;
                border: ${editMode ? '2px dashed #fff' : 'none'};
            }
            
            .ftth-btn:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
            
            #ftth-settings-btn { position: fixed; top: 10px; right: 10px; z-index: 9999; background: rgba(0,0,0,0.2); color: white; border: none; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; backdrop-filter: blur(4px); transition: all 0.3s; }
            #ftth-settings-btn:hover { background: rgba(0,0,0,0.6); transform: rotate(45deg); }
            
            #ftth-panel { position: fixed; top: 48px; right: 10px; z-index: 10000; background: #ffffff; border-radius: 16px; box-shadow: 0 15px 40px rgba(0,0,0,0.2); display: none; flex-direction: column; width: 340px; direction: rtl; font-family: 'Segoe UI', Tahoma, sans-serif; overflow: hidden; border: 1px solid #f0f0f0; animation: fadeIn 0.3s ease; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

            .tabs-header { display: flex; background: #fcfcfc; border-bottom: 1px solid #f0f0f0; }
            .tab-link { flex: 1; padding: 14px; text-align: center; cursor: pointer; font-size: 13px; font-weight: 700; color: #888; transition: all 0.3s; border-bottom: 2px solid transparent; }
            .tab-link.active { color: #2196F3; border-bottom-color: #2196F3; background: #fff; }
            
            .tabs-content { padding: 20px; max-height: 480px; overflow-y: auto; background: #fff; }
            .tab-pane { display: none; }
            .tab-pane.active { display: block; }
            
            .section-title { font-weight: 800; color: #222; margin: 18px 0 12px 0; font-size: 14px; display: flex; align-items: center; gap: 8px; border-right: 3px solid #2196F3; padding-right: 8px; }
            .s-item { margin-bottom: 10px; font-size: 13px; display: flex; align-items: center; color: #444; justify-content: space-between; }
            .s-item label { cursor: pointer; flex-grow: 1; margin-right: 5px; }
            .s-item input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: #2196F3; }
            
            .input-group { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
            .input-group label { font-size: 12px; font-weight: 600; color: #666; width: 80px; }
            .input-group input[type="color"] { border: none; width: 35px; height: 35px; cursor: pointer; background: none; }
            .input-group input[type="text"] { border: 1px solid #ddd; padding: 6px; border-radius: 6px; width: 50px; text-align: center; }
            
            .range-label { font-size: 12px; color: #555; margin-bottom: 5px; display: block; font-weight: 600; }
            input[type="range"] { width: 100%; height: 6px; background: #eee; border-radius: 5px; outline: none; accent-color: #2196F3; }
            
            .edit-mode-toggle { background: #f9f9f9; padding: 12px; border-radius: 10px; margin-bottom: 15px; border: 1px dashed #2196F3; }

            .btn-save-container { padding: 15px; background: #fcfcfc; border-top: 1px solid #f0f0f0; }
            #btn-save { width: 100%; padding: 12px; background: #2196F3; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 14px; transition: all 0.3s; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3); }
            #btn-save:hover { background: #1976D2; box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4); }
            
            .toast-info { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 12px 28px; border-radius: 50px; z-index: 10001; display: none; font-size: 14px; font-weight: 600; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
            .hide-pop { opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; }
        `;
    }

    const maintBtn = document.createElement('button'); maintBtn.id = 'ftth-maint-btn'; maintBtn.className = 'ftth-btn';
    const delivBtn = document.createElement('button'); delivBtn.id = 'ftth-deliv-btn'; delivBtn.className = 'ftth-btn';
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
                    <div class="section-title">🎨 مظهر الأيقونة</div>
                    <div class="input-group">
                        <label>اللون:</label>
                        <input type="color" id="maint_color" value="${settings.appearance.maint.color}">
                        <label>الإيموجي:</label>
                        <input type="text" id="maint_emoji" value="${settings.appearance.maint.emoji}">
                    </div>
                    <div class="range-container">
                        <label class="range-label">الحجم: <span id="val_m_size">${settings.appearance.maint.size}</span>px</label>
                        <input type="range" id="range_m_size" min="30" max="120" value="${settings.appearance.maint.size}">
                    </div>

                    <div class="section-title">📋 الحقول المنسوخة</div>
                    ${Object.keys(settings.maintenanceFields).map(k => `
                        <div class="s-item"><label for="m_${k}">${labels[k]}</label><input type="checkbox" id="m_${k}" ${settings.maintenanceFields[k] ? 'checked' : ''}></div>
                    `).join('')}
                    <div class="section-title">⚙️ التنبيهات</div>
                    <div class="s-item"><label for="m_p_alt">طلب هاتف بديل</label><input type="checkbox" id="m_p_alt" ${settings.maintenancePrompts.altPhone ? 'checked' : ''}></div>
                    <div class="s-item"><label for="m_p_prob">طلب وصف مشكلة</label><input type="checkbox" id="m_p_prob" ${settings.maintenancePrompts.problemDesc ? 'checked' : ''}></div>
                </div>
                
                <div class="tab-pane" id="deliv-tab">
                    <div class="section-title" style="border-right-color:#FF9800;">🎨 مظهر الأيقونة</div>
                    <div class="input-group">
                        <label>اللون:</label>
                        <input type="color" id="deliv_color" value="${settings.appearance.deliv.color}">
                        <label>الإيموجي:</label>
                        <input type="text" id="deliv_emoji" value="${settings.appearance.deliv.emoji}">
                    </div>
                    <div class="range-container">
                        <label class="range-label">الحجم: <span id="val_d_size">${settings.appearance.deliv.size}</span>px</label>
                        <input type="range" id="range_d_size" min="30" max="120" value="${settings.appearance.deliv.size}">
                    </div>

                    <div class="section-title" style="border-right-color:#FF9800;">📋 الحقول المنسوخة</div>
                    ${Object.keys(settings.deliveryFields).map(k => `
                        <div class="s-item"><label for="d_${k}">${labels[k]}</label><input type="checkbox" id="d_${k}" ${settings.deliveryFields[k] ? 'checked' : ''}></div>
                    `).join('')}
                    <div class="section-title" style="border-right-color:#FF9800;">⚙️ التنبيهات</div>
                    <div class="s-item"><label for="d_p_alt">طلب هاتف بديل</label><input type="checkbox" id="d_p_alt" ${settings.deliveryPrompts.altPhone ? 'checked' : ''}></div>
                    <div class="s-item"><label for="d_p_note">طلب ملاحظة</label><input type="checkbox" id="d_p_note" ${settings.deliveryPrompts.note ? 'checked' : ''}></div>
                </div>
                
                <div class="tab-pane" id="general-tab">
                    <div class="section-title">📍 تخصيص المواقع</div>
                    <div class="edit-mode-toggle s-item">
                        <label style="font-weight:700;">وضع تحريك الأزرار</label>
                        <input type="checkbox" id="toggle_edit_mode" ${editMode ? 'checked' : ''}>
                    </div>
                    <p style="font-size:12px; color:#666; line-height:1.5;">* عند تفعيل "وضع تحريك الأزرار"، يمكنك سحب الإيموجيات في الصفحة لوضعها في المكان المناسب لك. تذكر إطفاء الوضع بعد الانتهاء لتثبيتها.</p>
                    
                    <div class="section-title">ℹ️ معلومات</div>
                    <div class="s-item"><span>إصدار السكربت:</span> <span>${CURRENT_VERSION}</span></div>
                    <div class="s-item"><span>حالة الاتصال:</span> <span style="color:green;">متصل</span></div>
                </div>
            </div>
            <div class="btn-save-container">
                <button id="btn-save">حفظ وتطبيق</button>
            </div>
        `;
        panel.innerHTML = h;

        panel.querySelectorAll('.tab-link').forEach(link => {
            link.onclick = () => {
                panel.querySelectorAll('.tab-link, .tab-pane').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                panel.querySelector(`#${link.dataset.tab}`).classList.add('active');
            };
        });

        panel.querySelector('#range_m_size').oninput = (e) => panel.querySelector('#val_m_size').innerText = e.target.value;
        panel.querySelector('#range_d_size').oninput = (e) => panel.querySelector('#val_d_size').innerText = e.target.value;

        panel.querySelector('#toggle_edit_mode').onchange = (e) => {
            editMode = e.target.checked;
            updateBtnStyles();
        };

        document.getElementById('btn-save').onclick = async () => {
            for (const k in settings.maintenanceFields) settings.maintenanceFields[k] = document.getElementById(`m_${k}`).checked;
            settings.maintenancePrompts.altPhone = document.getElementById('m_p_alt').checked;
            settings.maintenancePrompts.problemDesc = document.getElementById('m_p_prob').checked;
            
            for (const k in settings.deliveryFields) settings.deliveryFields[k] = document.getElementById(`d_${k}`).checked;
            settings.deliveryPrompts.altPhone = document.getElementById('d_p_alt').checked;
            settings.deliveryPrompts.note = document.getElementById('d_p_note').checked;
            
            settings.appearance.maint.size = parseInt(document.getElementById('range_m_size').value);
            settings.appearance.maint.color = document.getElementById('maint_color').value;
            settings.appearance.maint.emoji = document.getElementById('maint_emoji').value;
            
            settings.appearance.deliv.size = parseInt(document.getElementById('range_d_size').value);
            settings.appearance.deliv.color = document.getElementById('deliv_color').value;
            settings.appearance.deliv.emoji = document.getElementById('deliv_emoji').value;

            await saveSettings(settings); 
            updateBtnStyles(); 
            panel.style.display = 'none'; 
            showT('✅ تم الحفظ بنجاح');
        };
    }

    // ==========================================
    // 5. منطق السحب والإفلات (فقط في وضع التحرير)
    // ==========================================
    function makeDraggable(el, type) {
        let isDragging = false;
        let startX, startY, initialRight, initialBottom;
        let moveThreshold = 5;

        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag, { passive: false });

        function startDrag(e) {
            if (!editMode) return; // منع السحب إذا لم يكن وضع التحرير مفعل
            
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
            
            if (isDragging) saveSettings(settings);
        }

        el.addEventListener('click', (e) => {
            if (isDragging || editMode) {
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

        const headIcon = type === 'maintenance' ? settings.appearance.maint.emoji : settings.appearance.deliv.emoji;
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
        showT('✅ تم النسخ بنجاح');
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
        
        maintBtn.onclick = () => { if(!editMode) collect('maintenance'); };
        delivBtn.onclick = () => { if(!editMode) collect('delivery'); };
        
        document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== setBtn) panel.style.display = 'none'; });
    });

})();
