// ==UserScript==
// @name         نظام النينجا لسحب البيانات (V5.0 - نظام الاستيراد والتصدير)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  نظام حفظ التقدم، الاستئناف التلقائي، ونقل الجلسات بين الحواسيب
// @author       Mntder
// @match        https://admin.ftth.iq/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const STATE_KEY = 'nippur_scraper_state';

    // تحميل الحالة السابقة إن وجدت
    let state = JSON.parse(localStorage.getItem(STATE_KEY)) || {
        allCustomers: [],
        scrapedData: [],
        currentIndex: 0,
        isScraping: false
    };

    const saveState = () => localStorage.setItem(STATE_KEY, JSON.stringify(state));
    const clearState = () => {
        localStorage.removeItem(STATE_KEY);
        state = { allCustomers: [], scrapedData: [], currentIndex: 0, isScraping: false };
    };

    const initUI = () => {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed; bottom: 30px; left: 30px; z-index: 999999;
            background: rgba(10, 15, 25, 0.95); backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px;
            padding: 20px; color: #fff; box-shadow: 0 10px 50px rgba(0,0,0,0.8);
            font-family: system-ui, -apple-system, sans-serif; direction: rtl;
            width: 320px; display: flex; flex-direction: column; gap: 10px;
        `;

        const title = document.createElement('h3');
        title.innerText = 'نظام السحب الشامل V5.0';
        title.style.cssText = 'margin: 0; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; text-align: center; color: #4CAF50;';

        const statusText = document.createElement('div');
        statusText.innerText = state.isScraping ? 'تم إعادة تحميل الصفحة، جاري الاستئناف...' : 'في الانتظار...';
        statusText.style.cssText = 'font-size: 13px; color: #aaa; font-weight: bold; text-align: center; min-height: 20px; line-height: 1.5;';

        const progressText = document.createElement('div');
        progressText.innerText = state.allCustomers.length > 0 ? `${state.currentIndex} / ${state.allCustomers.length}` : '0 / 0';
        progressText.style.cssText = 'font-size: 18px; color: #fff; text-align: center; direction: ltr; font-weight: bold; background: rgba(0,0,0,0.4); padding: 8px; border-radius: 8px; letter-spacing: 1px;';

        // أزرار التحكم الأساسية
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display: flex; gap: 5px; margin-top: 5px;';

        const startBtn = document.createElement('button');
        startBtn.innerText = state.allCustomers.length > 0 && state.currentIndex > 0 ? 'استئناف السحب' : 'بدء سحب جديد';
        startBtn.style.cssText = `flex: 2; background: #008CBA; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s;`;

        const exportCsvBtn = document.createElement('button');
        exportCsvBtn.innerText = 'تحميل CSV';
        exportCsvBtn.title = 'تحميل المشتركين كملف إكسل';
        exportCsvBtn.style.cssText = `flex: 1; background: #FF9800; color: #000; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 11px; transition: 0.2s;`;

        const resetBtn = document.createElement('button');
        resetBtn.innerText = 'تصفير';
        resetBtn.style.cssText = `flex: 1; background: #f44336; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s;`;

        // أزرار نقل الجلسة (الاستيراد والتصدير)
        const sessionDiv = document.createElement('div');
        sessionDiv.style.cssText = 'display: flex; gap: 5px; margin-top: 5px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px;';

        const exportStateBtn = document.createElement('button');
        exportStateBtn.innerHTML = '📤 تصدير الجلسة';
        exportStateBtn.title = 'حفظ الذاكرة كملف لنقله لحاسوب آخر';
        exportStateBtn.style.cssText = `flex: 1; background: #333; color: #fff; border: 1px solid #555; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 12px; transition: 0.2s;`;

        const importStateBtn = document.createElement('button');
        importStateBtn.innerHTML = '📥 استيراد الجلسة';
        importStateBtn.title = 'رفع ملف ذاكرة لإكمال السحب';
        importStateBtn.style.cssText = `flex: 1; background: #333; color: #fff; border: 1px solid #555; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 12px; transition: 0.2s;`;

        // برمجة الأزرار
        startBtn.onclick = async () => {
            startBtn.disabled = true; resetBtn.disabled = true;
            state.isScraping = true; saveState();
            await runScraper(statusText, progressText);
            startBtn.disabled = false; resetBtn.disabled = false;
        };

        exportCsvBtn.onclick = () => {
            if (state.scrapedData.length > 0) exportToCSV(state.scrapedData, 'Backup');
            else alert('لا توجد بيانات مسحوبة لتحميلها!');
        };

        resetBtn.onclick = () => {
            if(confirm('هل أنت متأكد من مسح الذاكرة بالكامل؟ (سيتم حذف تقدم السحب)')) {
                clearState();
                progressText.innerText = '0 / 0';
                startBtn.innerText = 'بدء سحب جديد';
                statusText.innerText = 'تم تصفير الذاكرة.';
            }
        };

        exportStateBtn.onclick = () => {
            if (state.allCustomers.length === 0) return alert('لا توجد جلسة نشطة لتصديرها!');
            // إيقاف السحب مؤقتاً قبل التصدير
            state.isScraping = false; saveState();

            const stateStr = JSON.stringify(state);
            const blob = new Blob([stateStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Nippur_Session_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            statusText.innerText = 'تم تصدير الجلسة بنجاح.';
        };

        importStateBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const importedState = JSON.parse(ev.target.result);
                        if (importedState && importedState.allCustomers) {
                            importedState.isScraping = false; // لا تبدأ تلقائياً بعد الاستيراد
                            localStorage.setItem(STATE_KEY, JSON.stringify(importedState));
                            alert('تم استيراد الجلسة بنجاح! سيتم تحديث الصفحة الآن.');
                            location.reload();
                        } else {
                            alert('الملف غير صالح أو تالف!');
                        }
                    } catch (err) {
                        alert('حدث خطأ أثناء قراءة ملف الجلسة!');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        controlsDiv.appendChild(startBtn);
        controlsDiv.appendChild(exportCsvBtn);
        controlsDiv.appendChild(resetBtn);

        sessionDiv.appendChild(exportStateBtn);
        sessionDiv.appendChild(importStateBtn);

        panel.appendChild(title);
        panel.appendChild(statusText);
        panel.appendChild(progressText);
        panel.appendChild(controlsDiv);
        panel.appendChild(sessionDiv);
        document.body.appendChild(panel);

        if (state.isScraping) {
            startBtn.click();
        }
    };

    const fetchJson = async (url) => {
        let token = localStorage.getItem('access_token') || '';
        if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = (!token.toLowerCase().startsWith('bearer ') ? 'Bearer ' : '') + token;

        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 401) throw new Error('401');
            if (response.status === 403 || response.status === 429 || response.status === 503) throw new Error('RATE_LIMIT');
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    };

    const runScraper = async (statusEl, progressEl) => {
        try {
            if (!localStorage.getItem('access_token')) {
                statusEl.innerText = 'خطأ: لم يتم العثور على التوكن.';
                state.isScraping = false; saveState();
                return;
            }

            if (state.allCustomers.length === 0) {
                statusEl.innerText = 'جاري جمع قوائم المشتركين (المرحلة 1)...';
                const firstPageData = await fetchJson('/api/customers?pageSize=100&pageNumber=1&sortCriteria.property=self.displayValue&sortCriteria.direction=asc');
                const totalPages = Math.ceil(firstPageData.totalCount / 100);
                state.allCustomers = [...firstPageData.items];

                for (let page = 2; page <= totalPages; page++) {
                    if (!state.isScraping) break;
                    statusEl.innerText = `جلب الصفحات: ${page} من ${totalPages}`;
                    const pageData = await fetchJson(`/api/customers?pageSize=100&pageNumber=${page}&sortCriteria.property=self.displayValue&sortCriteria.direction=asc`);
                    state.allCustomers.push(...pageData.items);
                    await sleep(300);
                }
                saveState();
            }

            statusEl.innerText = 'جاري استخراج التفاصيل بأمان...';
            statusEl.style.color = '#00BCD4';

            while (state.currentIndex < state.allCustomers.length) {
                if (!state.isScraping) break;

                const customer = state.allCustomers[state.currentIndex];
                const customerId = customer.self.id;

                try {
                    await sleep(1500);

                    const details = await fetchJson(`/api/customers/${customerId}`);
                    const subs = await fetchJson(`/api/customers/subscriptions?customerId=${customerId}`);

                    const name = details.model?.primaryContact?.self?.displayValue || 'غير متوفر';
                    const phone = details.model?.primaryContact?.mobile || 'غير متوفر';
                    const subItem = subs.items && subs.items.length > 0 ? subs.items[0] : null;
                    const username = subItem?.deviceDetails?.username || 'غير متوفر';
                    const serial = subItem?.deviceDetails?.serial || 'غير متوفر';
                    const fdt = subItem?.deviceDetails?.fdt?.displayValue || 'غير متوفر';
                    const fat = subItem?.deviceDetails?.fat?.displayValue || 'غير متوفر';

                    let subscriptionName = 'غير متوفر';
                    if (subItem?.services && subItem.services.length > 0) subscriptionName = subItem.services[0].id;
                    else if (subItem?.bundle) subscriptionName = subItem.bundle.id;

                    const startedAt = subItem?.startedAt ? new Date(subItem.startedAt).toLocaleDateString('en-GB') : 'غير متوفر';
                    const expires = subItem?.expires ? new Date(subItem.expires).toLocaleDateString('en-GB') : 'غير متوفر';

                    state.scrapedData.push({ name, phone, username, serial, fdt, fat, subscriptionName, startedAt, expires });
                    state.currentIndex++;

                    if (state.currentIndex % 5 === 0) saveState();

                    progressEl.innerText = `${state.currentIndex} / ${state.allCustomers.length}`;

                } catch (err) {
                    if (err.message === 'RATE_LIMIT' || err.name === 'TypeError' || err.message.includes('Failed to fetch')) {
                        saveState();
                        let countdown = 30;
                        statusEl.style.color = '#f44336';

                        const timer = setInterval(() => {
                            statusEl.innerText = `رصد حماية! تحديث الصفحة بعد ${countdown} ثانية للاستئناف...`;
                            countdown--;
                            if (countdown < 0) {
                                clearInterval(timer);
                                location.reload();
                            }
                        }, 1000);
                        return;

                    } else if (err.message === '401') {
                        state.isScraping = false; saveState();
                        throw err;
                    } else {
                        console.error(`تم تخطي ${customerId}`, err);
                        state.currentIndex++;
                        saveState();
                    }
                }
            }

            if (state.currentIndex >= state.allCustomers.length && state.allCustomers.length > 0) {
                statusEl.innerText = '✅ اكتمل السحب بالكامل!';
                statusEl.style.color = '#4CAF50';
                state.isScraping = false; saveState();
                exportToCSV(state.scrapedData, 'Complete');
            }

        } catch (error) {
            console.error(error);
            statusEl.innerText = error.message.includes('401') ? 'خطأ 401: جدد تسجيل الدخول.' : 'توقف السحب.';
            statusEl.style.color = '#f44336';
            state.isScraping = false; saveState();
        }
    };

    const exportToCSV = (dataArray, suffix = '') => {
        const headers = ['الاسم', 'رقم الهاتف', 'اليوزر', 'السيريال', 'FDT (الزون)', 'FAT', 'نوع الاشتراك', 'تاريخ التفعيل', 'تاريخ الانتهاء'];
        const csvRows = [headers.join(',')];

        for (const row of dataArray) {
            const values = [
                `"${row.name.replace(/"/g, '""')}"`, `"${row.phone}"`, `"${row.username}"`, `"${row.serial}"`,
                `"${row.fdt}"`, `"${row.fat}"`, `"${row.subscriptionName}"`, `"${row.startedAt}"`, `"${row.expires}"`
            ];
            csvRows.push(values.join(','));
        }

        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Nippur_Customers_${suffix}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    };

    window.addEventListener('load', initUI);

})();
