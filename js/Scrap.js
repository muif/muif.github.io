// ==UserScript==
// @name         Nippur FTTH Scraper Engine (Admin)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  نظام كشط وإدارة بيانات المشتركين
// @author       Mntder (Hussein)
// @match        https://admin.ftth.iq/*
// @require      https://unpkg.com/dexie/dist/dexie.js
// @grant        none
// ==/UserScript==

(async function () {
    'use strict';

    // ==========================================
    // 1. تهيئة قاعدة البيانات (IndexedDB via Dexie)
    // ==========================================
    const db = new Dexie("Nippur_FTTH_Database");
    db.version(1).stores({
        // subscriptionId هو المفتاح الرئيسي
        subscribers: `
            subscriptionId, customerId, customerName, mobile, username, serial,
            zone, fat, status, startedAt, expires, macAddress, ipAddress,
            devicePassword, rxPower, last_updated, scraping_status`
    });

    // متغيرات التحكم
    let isPaused = false;
    let isRunning = false;

    // ==========================================
    // 2. دوال المساعدة (Helpers)
    // ==========================================
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ==========================================
    // دالة الاتصال المدرعة (مع نظام إعادة المحاولة الذكي)
    // ==========================================
    async function fetchAPI(endpoint, retries = 3) {
        const token = localStorage.getItem('access_token');
        if (!token) {
            isPaused = true;
            return { error: 'NO_TOKEN' };
        }

        const headers = {
            'Authorization': (!token.toLowerCase().startsWith('bearer ') ? 'Bearer ' : '') + token,
            'Content-Type': 'application/json'
        };

        // نظام إعادة المحاولة التلقائي المخفي
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(endpoint, { headers });

                if (response.status === 401 || response.status === 403) {
                    return { error: 'UNAUTHORIZED' };
                }

                // اصطياد أخطاء الضغط (503 Service Unavailable أو 429 أو 504)
                if (response.status === 503 || response.status === 429 || response.status === 504) {
                    console.warn(`⚠️ السيرفر متعب (الخطأ ${response.status}). محاولة ${i + 1} من ${retries} بعد قليل...`);
                    // التراجع المتضاعف: 5 ثواني ثم 10 ثواني ثم 15 ثانية
                    await sleep(5000 * (i + 1));
                    continue; // إعادة المحاولة من جديد
                }

                if (!response.ok) {
                    return { error: `HTTP_${response.status}` };
                }

                return await response.json(); // نجاح العملية

            } catch (error) {
                console.warn(`⚠️ فشل في الاتصال بالشبكة. محاولة ${i + 1} من ${retries}...`);
                await sleep(5000 * (i + 1));
            }
        }

        // إذا استنفد كل المحاولات والسيرفر لا يزال معطلاً
        return { error: 'MAX_RETRIES_REACHED' };
    }

    // ==========================================
    // 3. محرك الكشط (Scraping Engine)
    // ==========================================

    // المرحلة الأولى: جلب كل المشتركين كـ Pending (مدمجة مع تكتيك النينجا)
    async function phaseOne_FetchIDs() {
        if (isRunning) return alert("العملية قيد التشغيل بالفعل!");
        isRunning = true;
        isPaused = false;

        document.getElementById('sc-status').innerText = "الحالة: جلب الصفحة الأولى لتحديد العدد...";

        try {
            // 1. جلب الصفحة الأولى لمعرفة العدد الكلي
            const firstPageUrl = `https://admin.ftth.iq/api/customers?pageSize=100&pageNumber=1&sortCriteria.property=self.displayValue&sortCriteria.direction=asc`;
            const firstPageData = await fetchAPI(firstPageUrl);

            if (!firstPageData) {
                isRunning = false;
                return alert("فشل في جلب الصفحة الأولى! تأكد من التوكن.");
            }

            const totalCount = firstPageData.totalCount;
            const totalPages = Math.ceil(totalCount / 100); // تكتيك النينجا لحساب الصفحات
            let savedCount = await db.subscribers.count();

            // دالة مساعدة لسرعة حفظ الدفعات في IndexedDB
            const saveBatch = async (items) => {
                let newAdded = 0;
                for (let item of items) {
                    const cusId = item.self.id;
                    const cusName = item.self.displayValue;
                    const tempId = `TEMP_${cusId}`; // مفتاح مؤقت لحين جلب معرف الاشتراك

                    const exists = await db.subscribers.where('customerId').equals(cusId).count();
                    if (exists === 0) {
                        await db.subscribers.put({
                            subscriptionId: tempId,
                            customerId: cusId,
                            customerName: cusName,
                            scraping_status: 'pending',
                            last_updated: new Date().toISOString()
                        });
                        newAdded++;
                    }
                }
                return newAdded;
            };

            // حفظ بيانات الصفحة الأولى
            savedCount += await saveBatch(firstPageData.items);
            document.getElementById('sc-progress').innerText = `بداخل القاعدة: ${savedCount} / ${totalCount}`;

            // 2. حلقة متسلسلة لباقي الصفحات (من 2 إلى النهاية)
            for (let page = 2; page <= totalPages; page++) {
                if (isPaused) break;

                document.getElementById('sc-status').innerText = `جاري جلب الصفحة: ${page} من ${totalPages}...`;

                let success = false;
                let retries = 0;

                // نظام الحماية: إذا رفض السيرفر الصفحة، يحاول 5 مرات قبل أن يستسلم
                while (!success && retries < 5 && !isPaused) {
                    const url = `https://admin.ftth.iq/api/customers?pageSize=100&pageNumber=${page}&sortCriteria.property=self.displayValue&sortCriteria.direction=asc`;
                    const pageData = await fetchAPI(url);

                    if (pageData && pageData.items) {
                        savedCount += await saveBatch(pageData.items);
                        document.getElementById('sc-progress').innerText = `بداخل القاعدة: ${savedCount} / ${totalCount}`;
                        success = true;
                    } else {
                        retries++;
                        document.getElementById('sc-status').innerText = `رصد حماية بالصفحة ${page}. إعادة المحاولة ${retries}/5 بعد 5 ثوانٍ...`;
                        document.getElementById('sc-status').style.color = "#ff9800";
                        await sleep(5000);
                    }
                }

                if (!success) {
                    alert(`فشل نهائي في جلب الصفحة ${page} بعد 5 محاولات. تم الإيقاف المؤقت.`);
                    isPaused = true;
                    break;
                }

                document.getElementById('sc-status').style.color = "#fff"; // إعادة اللون الطبيعي
                await sleep(500); // تأخير بسيط جداً لعدم إرهاق السيرفر (نصف ثانية)
            }

            if (!isPaused) {
                document.getElementById('sc-status').innerText = "الحالة: اكتملت المرحلة 1 بنجاح ✅";
                document.getElementById('sc-status').style.color = "#00ff88";
            }

        } catch (error) {
            console.error(error);
            document.getElementById('sc-status').innerText = "حدث خطأ غير متوقع ❌";
        }

        isRunning = false;
    }



    // ==========================================
    // المرحلة الثانية: السحب العميق للتفاصيل المتسلسلة
    // ==========================================
    async function phaseTwo_DeepScrape() {
        if (isRunning) return alert("العملية قيد التشغيل بالفعل!");
        isRunning = true;
        isPaused = false;

        document.getElementById('sc-status').innerText = "الحالة: جاري تحضير طابور العمل...";

        // 1. جلب المشتركين الذين ينتظرون السحب (حالتهم pending)
        const pendingList = await db.subscribers.where('scraping_status').equals('pending').toArray();
        const totalPending = pendingList.length;

        if (totalPending === 0) {
            document.getElementById('sc-status').innerText = "لا يوجد مشتركين بحالة Pending. السحب مكتمل! ✅";
            document.getElementById('sc-status').style.color = "#00ff88";
            isRunning = false;
            return;
        }

        let processed = 0;

        for (let user of pendingList) {
            if (isPaused) break;

            const cusId = user.customerId;
            document.getElementById('sc-status').innerText = `جاري سحب: ${user.customerName.substring(0, 20)}...`;

            try {
                // [الرابط 1]: جلب رقم الهاتف
                let mobile = "";
                const detailsData = await fetchAPI(`https://admin.ftth.iq/api/customers/${cusId}`);
                if (detailsData && detailsData.model && detailsData.model.primaryContact) {
                    mobile = detailsData.model.primaryContact.mobile || "";
                }

                // [الرابط 2]: جلب الاشتراكات
                const subsData = await fetchAPI(`https://admin.ftth.iq/api/customers/subscriptions?customerId=${cusId}`);
                const items = (subsData && subsData.items) ? subsData.items : [];

                if (items.length === 0) {
                    // إذا لم يكن لديه اشتراكات فعلية، نحدث بياناته وننهي حالته
                    await db.subscribers.update(user.subscriptionId, {
                        mobile: mobile,
                        scraping_status: 'completed',
                        last_updated: new Date().toISOString()
                    });
                } else {
                    // [الاشتراكات موجودة]: نحذف المعرف المؤقت أولاً
                    await db.subscribers.delete(user.subscriptionId);

                    // حلقة تكرار لكل اشتراك (لحل مشكلة المشتركين متعددي الاشتراكات)
                    for (let item of items) {
                        if (isPaused) break;

                        const subId = item.self?.id || null;
                        const username = item.deviceDetails?.username || "";
                        const serial = item.deviceDetails?.serial || "";
                        const zone = item.zone?.displayValue || "";
                        const fat = item.deviceDetails?.fat?.displayValue || "";
                        const status = item.status || "";
                        const startedAt = item.startedAt || "";
                        const expires = item.expires || "";
                        const macAddress = item.macAddress || "";
                        const ipAddress = item.ipAddress || "";

                        // [الرابط 3]: جلب الباسورد بمعرف الاشتراك الحقيقي
                        let devicePassword = "";
                        if (subId) {
                            const deviceData = await fetchAPI(`https://admin.ftth.iq/api/subscriptions/${subId}/device`);
                            if (deviceData && deviceData.model) {
                                devicePassword = deviceData.model.devicePassword || "";
                            }
                        }

                        // [الرابط 4]: جلب الإشارة باليوزر
                        let rxPower = "";
                        if (username) {
                            const ontData = await fetchAPI(`https://admin.ftth.iq/api/subscriptions/device/ont?username=${username}`);
                            if (ontData && ontData.model && ontData.model.rxPower !== undefined) {
                                rxPower = ontData.model.rxPower;
                            }
                        }

                        // [حفظ الاشتراك كصف نهائي متكامل في القاعدة]
                        // إذا كان المعرف غير موجود لسبب ما، نولد معرفا بديلا لضمان عدم حدوث خطأ
                        const finalSubId = subId ? String(subId) : `NO_SUB_${cusId}_${Math.random().toString(36).substring(7)}`;

                        await db.subscribers.put({
                            subscriptionId: finalSubId,
                            customerId: cusId,
                            customerName: user.customerName,
                            mobile: mobile,
                            username: username,
                            serial: serial,
                            zone: zone,
                            fat: fat,
                            status: status,
                            startedAt: startedAt,
                            expires: expires,
                            macAddress: macAddress,
                            ipAddress: ipAddress,
                            devicePassword: devicePassword,
                            rxPower: rxPower,
                            last_updated: new Date().toISOString(),
                            scraping_status: 'completed'
                        });

                        await sleep(500); // تأخير خفيف بين الاشتراكات المتعددة لنفس المشترك
                    }
                }

                processed++;
                document.getElementById('sc-progress').innerText = `اكتمل: ${processed} / ${totalPending}`;

                // تأخير 1.5 ثانية لحماية السيرفر (Rate Limit Protection)
                await sleep(1500);

            } catch (error) {
                console.error(`حدث خطأ أثناء سحب المشترك ${cusId}:`, error);
                document.getElementById('sc-status').innerText = `تعثر في ${user.customerName}، سيتم تجاوزه.`;
                document.getElementById('sc-status').style.color = "#ff9800";
                await sleep(3000); // استراحة أطول عند الأخطاء لامتصاص غضب السيرفر
                // ملاحظة: لم نغير الحالة، فستبقى pending لكي يسحبها السكربت في المرة القادمة
            }

            document.getElementById('sc-status').style.color = "#fff"; // إعادة لون النص
        }

        if (!isPaused) {
            document.getElementById('sc-status').innerText = "الحالة: اكتملت المرحلة 2 بنجاح 🚀";
            document.getElementById('sc-status').style.color = "#00ff88";
        }
        isRunning = false;
    }


    // ==========================================
    // 4. دوال التصدير والاستيراد (Export/Import)
    // ==========================================

    async function exportToJSON() {
        const allData = await db.subscribers.toArray();
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Nippur_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function importFromJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    await db.subscribers.bulkPut(data);
                    alert("✅ تم استيراد البيانات بنجاح!");
                } else {
                    alert("❌ صيغة الملف غير صحيحة.");
                }
            } catch (err) {
                alert("❌ حدث خطأ أثناء قراءة الملف.");
            }
        };
        reader.readAsText(file);
    }

    // ==========================================
    // دالة تصدير CSV (المحدثة - الأعمدة الثابتة)
    // ==========================================
    async function exportToCSV() {
        const allData = await db.subscribers.toArray();
        if (allData.length === 0) return alert("لا توجد بيانات لتصديرها!");

        // 1. تحديد المعرفات البرمجية للأعمدة لضمان جلبها كلها حتى لو كانت فارغة
        const keys = [
            "subscriptionId", "customerId", "customerName", "mobile",
            "username", "serial", "zone", "fat", "status",
            "startedAt", "expires", "macAddress", "ipAddress",
            "devicePassword", "rxPower", "last_updated", "scraping_status"
        ];

        // 2. العناوين التي ستظهر في رأس ملف الإكسل (بالعربي للترتيب)
        const arabicHeaders = [
            "معرف الاشتراك", "رقم المشترك", "الاسم", "رقم الهاتف",
            "اليوزر", "السيريال", "الزون (FDT)", "الـ FAT", "الحالة",
            "تاريخ التفعيل", "تاريخ الانتهاء", "الماك ادرس", "الاي بي",
            "الباسورد", "الإشارة (Rx)", "آخر تحديث", "حالة السحب"
        ];

        const csvRows = [];

        // إضافة صف العناوين
        csvRows.push(arabicHeaders.join(','));

        // إضافة البيانات
        for (const row of allData) {
            const values = keys.map(key => {
                // إذا كان الحقل غير موجود (مثل المشترك الذي ليس لديه يوزر)، نضع فراغ
                const val = row[key] === null || row[key] === undefined ? "" : row[key];
                // تغليف النصوص بعلامات تنصيص لحماية الفواصل
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        }

        // دعم اللغة العربية uFEFF
        const csvString = "\uFEFF" + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Nippur_Subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // 5. بناء الواجهة الزجاجية (Glassmorphism UI)
    // ==========================================
    function createUI() {
        const uiHTML = `
            <div id="nippur-hud" style="
                position: fixed; bottom: 20px; left: 20px; z-index: 999999;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 15px; padding: 20px; width: 320px;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
                font-family: 'Tajawal', Tahoma, Arial, sans-serif;
                direction: rtl; color: #fff;
            ">
                <h3 style="margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; color: #00d2ff;">🚀 محرك Nippur</h3>

                <div id="sc-status" style="font-size: 14px; margin-bottom: 5px; color: #fff;">الحالة: متوقف</div>
                <div id="sc-progress" style="font-size: 14px; margin-bottom: 15px; font-weight: bold; color: #00ff88;">تم جلب: 0 / 0</div>

                <button id="btn-phase1" style="width: 100%; padding: 10px; margin-bottom: 10px; background: #007bff; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">1️⃣ جلب أيدي المشتركين (المرحلة 1)</button>
                <button id="btn-phase2" style="width: 100%; padding: 10px; margin-bottom: 10px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">2️⃣ بدء سحب التفاصيل (المرحلة 2)</button>
                <button id="btn-open-dash" style="width: 100%; padding: 12px; margin-bottom: 10px; background: linear-gradient(45deg, #673ab7, #3f51b5); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; border: 1px solid rgba(255,255,255,0.2);">🗃️ فتح سجل المشتركين</button>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button id="btn-csv" style="flex: 1; padding: 8px; background: #ff9800; color: white; border: none; border-radius: 8px; cursor: pointer;">تصدير CSV</button>
                    <button id="btn-json-exp" style="flex: 1; padding: 8px; background: #9c27b0; color: white; border: none; border-radius: 8px; cursor: pointer;">تصدير JSON</button>
                </div>

                <label style="display: block; width: 100%; padding: 8px; background: #607d8b; color: white; border: none; border-radius: 8px; cursor: pointer; text-align: center; box-sizing: border-box;">
                    استيراد JSON 📥
                    <input type="file" id="file-import" accept=".json" style="display: none;">
                </label>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', uiHTML);

        // ربط الأزرار بالدوال
        document.getElementById('btn-phase1').addEventListener('click', phaseOne_FetchIDs);
        document.getElementById('btn-csv').addEventListener('click', exportToCSV);
        document.getElementById('btn-json-exp').addEventListener('click', exportToJSON);
        document.getElementById('file-import').addEventListener('change', importFromJSON);

        // زر المرحلة الثانية (سنكتب دالته في الخطوة القادمة)
        document.getElementById('btn-phase2').addEventListener('click', phaseTwo_DeepScrape);
        document.getElementById('btn-open-dash').addEventListener('click', openDashboard);
    }

    // تشغيل الواجهة عند اكتمال تحميل الصفحة
    window.addEventListener('load', createUI);


    // ==========================================
    // 6. المراقب الصامت (Passive Update) - تحديث محلي
    // ==========================================

    // 1. دالة إظهار إشعار سريع (Toast Notification)
    function showToast(message) {
        const toast = document.createElement('div');
        toast.innerText = message;
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(40, 167, 69, 0.95); color: white; padding: 12px 24px;
            border-radius: 8px; z-index: 9999999; font-family: 'Tajawal', sans-serif; font-size: 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4); transition: opacity 0.5s ease-in-out;
        `;
        document.body.appendChild(toast);
        // إخفاء الإشعار بعد 3 ثوانٍ
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    // 2. دالة التحديث في الخلفية لمشترك واحد (المحدثة والشاملة)
    async function silentUpdateCustomer(cusId) {
        try {
            // [الرابط 1]: الهاتف والاسم
            const detailsData = await fetchAPI(`https://admin.ftth.iq/api/customers/${cusId}`);
            if (!detailsData || detailsData.error) return;
            const mobile = detailsData.model?.primaryContact?.mobile || "";
            const customerName = detailsData.model?.primaryContact?.self?.displayValue || "";

            // [الرابط 2]: الاشتراكات
            const subsData = await fetchAPI(`https://admin.ftth.iq/api/customers/subscriptions?customerId=${cusId}`);
            if (!subsData || subsData.error) return;
            const items = subsData.items || [];

            // خطوة الأمان: مسح السجلات القديمة لتجنب التكرار (ننفذها في كل الحالات)
            const oldRecords = await db.subscribers.where('customerId').equals(String(cusId)).toArray();
            for (let record of oldRecords) {
                await db.subscribers.delete(record.subscriptionId);
            }

            if (items.length > 0) {
                // المشترك لديه اشتراكات فعلية
                for (let item of items) {
                    const subId = item.self?.id || null;
                    const username = item.deviceDetails?.username || "";

                    let devicePassword = "";
                    let rxPower = "";

                    if (subId) {
                        const deviceData = await fetchAPI(`https://admin.ftth.iq/api/subscriptions/${subId}/device`);
                        if (deviceData && !deviceData.error && deviceData.model) {
                            devicePassword = deviceData.model.devicePassword || "";
                        }
                    }

                    if (username) {
                        const ontData = await fetchAPI(`https://admin.ftth.iq/api/subscriptions/device/ont?username=${username}`);
                        if (ontData && !ontData.error && ontData.model) {
                            rxPower = ontData.model.rxPower !== undefined ? ontData.model.rxPower : "";
                        }
                    }

                    const finalSubId = subId ? String(subId) : `NO_SUB_${cusId}_${Math.random().toString(36).substring(7)}`;

                    await db.subscribers.put({
                        subscriptionId: finalSubId,
                        customerId: String(cusId),
                        customerName: customerName,
                        mobile: mobile,
                        username: username,
                        serial: item.deviceDetails?.serial || "",
                        zone: item.zone?.displayValue || "",
                        fat: item.deviceDetails?.fat?.displayValue || "",
                        status: item.status || "",
                        startedAt: item.startedAt || "",
                        expires: item.expires || "",
                        macAddress: item.macAddress || "",
                        ipAddress: item.ipAddress || "",
                        devicePassword: devicePassword,
                        rxPower: rxPower,
                        last_updated: new Date().toISOString(),
                        scraping_status: 'completed'
                    });
                }
            } else {
                // 🔴 المشترك جديد أو ليس لديه راوتر/يوزر (نحفظ الأساسيات فقط)
                await db.subscribers.put({
                    subscriptionId: `NO_SUB_${cusId}`,
                    customerId: String(cusId),
                    customerName: customerName,
                    mobile: mobile,
                    username: "", serial: "", zone: "", fat: "", status: "", startedAt: "", expires: "",
                    macAddress: "", ipAddress: "", devicePassword: "", rxPower: "",
                    last_updated: new Date().toISOString(),
                    scraping_status: 'completed'
                });
            }

            // إظهار رسالة النجاح في أعلى الشاشة
            showToast(`✅ محرك Nippur: تم تحديث بيانات (${customerName}) في الخلفية`);

        } catch (error) {
            console.error(`فشل التحديث الصامت للمشترك ${cusId}:`, error);
        }
    }


    // 3. رادار مراقبة تغير الروابط (تم تحديث الـ Regex ليتطابق مع مسار الموقع)
    function handleLocationChange() {
        const url = location.href;

        // هنا السحر: يبحث عن /customer-details/ متبوعاً بأرقام
        const match = url.match(/\/customer-details\/(\d+)/i);

        if (match && match[1]) {
            const customerId = match[1];
            // انتظار ثانيتين لضمان استقرار الصفحة، ثم السحب الصامت
            setTimeout(() => silentUpdateCustomer(customerId), 2000);
        }
    }

    // زرع الرادار في دوال المتصفح لمراقبة التنقل بدون عمل Refresh
    const originalPushState = history.pushState;
    history.pushState = function () {
        originalPushState.apply(this, arguments);
        handleLocationChange();
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function () {
        originalReplaceState.apply(this, arguments);
        handleLocationChange();
    };
    window.addEventListener('popstate', handleLocationChange);

    // فحص الرابط عند تحميل الصفحة لأول مرة
    window.addEventListener('load', handleLocationChange);


    // ==========================================
    // 7. واجهة سجل المشتركين الشامل (Dashboard)
    // ==========================================

    let dashCurrentPage = 1;
    const dashRowsPerPage = 50;
    let dashSearchQuery = "";

    function openDashboard() {
        let dashModal = document.getElementById('nippur-dashboard');

        // بناء الواجهة إذا لم تكن موجودة
        if (!dashModal) {
            const html = `
                <div id="nippur-dashboard" style="
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999;
                    background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                    color: white; font-family: 'Tajawal', sans-serif; direction: rtl; display: flex; flex-direction: column;
                ">
                    <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; color: #00ff88;">📊 سجل المشتركين الشامل</h2>
                        <input type="text" id="dash-search" placeholder="🔍 ابحث بالاسم، اليوزر، الهاتف، أو الآيدي..." style="
                            width: 400px; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
                            background: rgba(0,0,0,0.3); color: white; outline: none; font-family: inherit;
                        ">
                        <button id="dash-close" style="background: #dc3545; color: white; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;">إغلاق X</button>
                    </div>

                    <div style="flex: 1; overflow: auto; padding: 20px;">
                        <table style="width: 100%; border-collapse: collapse; min-width: 1200px;">
                            <thead style="background: rgba(255,255,255,0.05); position: sticky; top: -20px; z-index: 10;">
                                <tr>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">رقم المشترك</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">الاسم</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">الهاتف</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">اليوزر</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">الباسورد</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">الإشارة</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">الزون</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">حالة السحب</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #00d2ff;">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="dash-tbody">
                                </tbody>
                        </table>
                    </div>

                    <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: center; gap: 20px; align-items: center; background: rgba(0,0,0,0.2);">
                        <button id="dash-prev" style="background: #007bff; color: white; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer;">السابق</button>
                        <span id="dash-page-info" style="font-weight: bold;">صفحة 1</span>
                        <button id="dash-next" style="background: #007bff; color: white; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer;">التالي</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            dashModal = document.getElementById('nippur-dashboard');

            // ربط أحداث الإغلاق والبحث والتقسيم
            document.getElementById('dash-close').addEventListener('click', () => {
                dashModal.style.display = 'none';
            });

            document.getElementById('dash-search').addEventListener('input', (e) => {
                dashSearchQuery = e.target.value;
                dashCurrentPage = 1; // العودة للصفحة الأولى عند البحث
                renderDashboardTable();
            });

            document.getElementById('dash-prev').addEventListener('click', () => {
                if (dashCurrentPage > 1) { dashCurrentPage--; renderDashboardTable(); }
            });

            document.getElementById('dash-next').addEventListener('click', () => {
                dashCurrentPage++; renderDashboardTable();
            });

            // تفويض الأحداث لأزرار الحذف والتحديث (لتجنب مشاكل الرام)
            document.getElementById('dash-tbody').addEventListener('click', async (e) => {
                const target = e.target;
                // --- الزر الجديد: عرض التفاصيل ---
                if (target.classList.contains('btn-view')) {
                    const subId = target.dataset.subid;
                    const user = await db.subscribers.get(subId); // جلب بيانات المشترك من القاعدة
                    if (user) {
                        showDetailsModal(user); // عرض النافذة
                    }
                }
                // زر التحديث الفردي
                if (target.classList.contains('btn-upd')) {
                    const cusId = target.dataset.cusid;
                    const originalText = target.innerText;
                    target.innerText = "جاري...";
                    target.style.background = "#ff9800";

                    await silentUpdateCustomer(cusId); // استدعاء دالة التحديث الصامت
                    await renderDashboardTable(); // إعادة رسم الجدول
                }

                // زر الحذف (المسح الجزئي وإعادة للانتظار)
                if (target.classList.contains('btn-del')) {
                    const subId = target.dataset.subid;
                    const cusId = target.dataset.cusid;
                    const name = target.dataset.name;

                    if (confirm(`هل أنت متأكد من مسح بيانات (${name}) وإعادته لطابور الانتظار؟`)) {
                        await db.subscribers.delete(subId); // حذف السجل الممتلئ

                        // إعادة زرعه كمسودة فارغة
                        await db.subscribers.put({
                            subscriptionId: `TEMP_${cusId}`,
                            customerId: cusId,
                            customerName: name,
                            mobile: "", username: "", serial: "", zone: "", fat: "",
                            status: "", startedAt: "", expires: "", macAddress: "", ipAddress: "",
                            devicePassword: "", rxPower: "",
                            last_updated: new Date().toISOString(),
                            scraping_status: "pending"
                        });

                        showToast(`تم مسح بيانات ${name} بنجاح.`);
                        renderDashboardTable();
                    }
                }
            });
        }

        dashModal.style.display = 'flex';
        dashSearchQuery = "";
        document.getElementById('dash-search').value = "";
        dashCurrentPage = 1;
        renderDashboardTable();
    }

    // دالة جلب البيانات ورسم الجدول
    async function renderDashboardTable() {
        let allUsers = await db.subscribers.toArray();

        // تطبيق فلتر البحث
        if (dashSearchQuery) {
            const q = dashSearchQuery.toLowerCase();
            allUsers = allUsers.filter(u =>
                (u.customerName && u.customerName.toLowerCase().includes(q)) ||
                (u.customerId && String(u.customerId).includes(q)) ||
                (u.username && u.username.toLowerCase().includes(q)) ||
                (u.mobile && String(u.mobile).includes(q))
            );
        }

        // حساب التقسيم
        const totalPages = Math.ceil(allUsers.length / dashRowsPerPage) || 1;
        if (dashCurrentPage > totalPages) dashCurrentPage = totalPages;

        const startIdx = (dashCurrentPage - 1) * dashRowsPerPage;
        const pageData = allUsers.slice(startIdx, startIdx + dashRowsPerPage);

        // بناء الـ HTML للصفوف
        const tbody = document.getElementById('dash-tbody');
        let rowsHTML = '';

        for (let user of pageData) {
            // تلوين الإشارة إذا كانت سيئة
            let rxStyle = "color: white;";
            const rxNum = parseFloat(user.rxPower);
            if (!isNaN(rxNum) && (rxNum < -26 || rxNum > -10)) rxStyle = "color: #ff4c4c; font-weight: bold;";

            rowsHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
                    <td style="padding: 10px;">${user.customerId}</td>
                    <td style="padding: 10px;">${user.customerName}</td>
                    <td style="padding: 10px;">${user.mobile}</td>
                    <td style="padding: 10px; color: #00d2ff;">${user.username}</td>
                    <td style="padding: 10px; color: #ffeb3b;">${user.devicePassword}</td>
                    <td style="padding: 10px; ${rxStyle}">${user.rxPower}</td>
                    <td style="padding: 10px;">${user.zone}</td>
                    <td style="padding: 10px;">
                        <span style="background: ${user.scraping_status === 'completed' ? '#28a745' : '#ff9800'}; padding: 3px 8px; border-radius: 4px; font-size: 12px;">
                            ${user.scraping_status}
                        </span>
                    </td>
                    <td style="padding: 10px; display: flex; gap: 5px;">
                        <button class="btn-view" data-subid="${user.subscriptionId}" style="background: #6f42c1; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">👁️ التفاصيل</button>
                        <button class="btn-upd" data-cusid="${user.customerId}" style="background: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">🔄 تحديث</button>
                        <button class="btn-del" data-subid="${user.subscriptionId}" data-cusid="${user.customerId}" data-name="${user.customerName}" style="background: rgba(220, 53, 69, 0.2); color: #ff4c4c; border: 1px solid #dc3545; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️ مسح</button>
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = rowsHTML;

        // تحديث معلومات الصفحة وإدارة أزرار التالي/السابق
        document.getElementById('dash-page-info').innerText = `صفحة ${dashCurrentPage} من ${totalPages} (الإجمالي: ${allUsers.length})`;
        document.getElementById('dash-prev').disabled = dashCurrentPage === 1;
        document.getElementById('dash-next').disabled = dashCurrentPage === totalPages;
    }

    // ==========================================
    // 8. دالة عرض تفاصيل المشترك الكاملة (Modal)
    // ==========================================
    function showDetailsModal(user) {
        // إغلاق أي نافذة تفاصيل سابقة إن وجدت
        const existingModal = document.getElementById('nippur-details-modal');
        if (existingModal) existingModal.remove();

        // تجهيز القاموس لترجمة الحقول للعربية
        const labels = {
            "subscriptionId": "معرف الاشتراك", "customerId": "رقم المشترك",
            "customerName": "الاسم", "mobile": "رقم الهاتف",
            "username": "اليوزر", "devicePassword": "الباسورد",
            "serial": "السيريال", "macAddress": "الماك أدرس",
            "ipAddress": "الآي بي", "rxPower": "الإشارة (Rx)",
            "zone": "الزون (FDT)", "fat": "الـ FAT",
            "status": "حالة الاشتراك", "startedAt": "تاريخ التفعيل",
            "expires": "تاريخ الانتهاء", "last_updated": "تاريخ السحب",
            "scraping_status": "حالة السحب"
        };

        // بناء حقول البيانات
        let detailsHTML = '';
        for (const [key, label] of Object.entries(labels)) {
            const val = user[key] || "غير متوفر";
            detailsHTML += `
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="color: #00d2ff; font-size: 12px; margin-bottom: 4px;">${label}</div>
                    <div style="font-weight: bold; font-size: 14px; color: ${val === 'غير متوفر' ? '#aaa' : '#fff'};">${val}</div>
                </div>
            `;
        }

        // بناء الواجهة الزجاجية
        const modalHTML = `
            <div id="nippur-details-modal" style="
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 99999999;
                background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px);
                display: flex; justify-content: center; align-items: center; font-family: 'Tajawal', sans-serif; direction: rtl;
            ">
                <div style="
                    background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 16px; padding: 25px; width: 600px; max-width: 90%; max-height: 90vh; overflow-y: auto;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5); color: white;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 20px;">
                        <h3 style="margin: 0; color: #00ff88;">🪪 بطاقة المشترك: ${user.customerName}</h3>
                        <button id="close-details-btn" style="background: #dc3545; color: white; border: none; padding: 5px 15px; border-radius: 6px; cursor: pointer;">إغلاق</button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${detailsHTML}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // ربط زر الإغلاق
        document.getElementById('close-details-btn').addEventListener('click', () => {
            document.getElementById('nippur-details-modal').remove();
        });
    }


})();
