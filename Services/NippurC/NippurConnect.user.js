// ==UserScript==
// @name         NippurConnect Delivery
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  النظام المركزي المطور مع محرك إعدادات ديناميكي متقدم يدعم كافة أنواع الأدوات
// @author       MuntadherImad 
// @match        https://nippurconnect.com/admin/*
// @updateURL    https://github.com/muif/muif.github.io/raw/refs/heads/main/Services/NippurC/NippurConnect.user.js
// @downloadURL  https://github.com/muif/muif.github.io/raw/refs/heads/main/Services/NippurC/NippurConnect.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    // 1. الإعدادات والتحكم (System Core Settings)
    // =========================================================================
    const SYSTEM_CORE = {
        version: "6.2",
        globalEnabled: true,
        logs: [],
        log: function (moduleName, error) {
            console.error(`[Core Error - ${moduleName}]:`, error);
            this.logs.push({ module: moduleName, error: error.toString(), time: new Date() });
        }
    };

    // =========================================================================
    // 0. نظام التحقق من التحديثات والإعدادات عن بعد (Remote Sync & Updates)
    // =========================================================================
    async function checkRemoteConfigAndUpdates() {
        try {
            // استبدل الرابط أدناه برابط ملف الـ json الخام (Raw) من مستودع GitHub الخاص بك
            const response = await fetch('https://github.com/muif/muif.github.io/raw/refs/heads/main/Services/NippurC/config.json', { cache: 'no-store' });
            if (!response.ok) return;
            const remoteConfig = await response.json();

            // 1. التحقق من التعطيل الشامل من قبل المطور
            if (remoteConfig.globalEnabled === false) {
                console.warn("حدث مشكلة مع الخادم.");
                return false; // إيقاف التشغيل
            }

            // 2. التحقق من التحديث الإجباري (Force Update)
            if (remoteConfig.remoteVersion && remoteConfig.remoteVersion !== SYSTEM_CORE.version) {
                const isAutoUpdateEnabled = localStorage.getItem('nippur_auto_update') === 'true';

                if (remoteConfig.forceUpdate || isAutoUpdateEnabled) {
                    // عرض تنبيه إجباري أو توجيه للتثبيت
                    showUpdateNotification(remoteConfig.updateUrl, remoteConfig.forceUpdate);
                }
            }

            // 3. دمج أو تجاوز إعدادات الكتل المعطلة عن بعد
            if (remoteConfig.disabledModules && Array.isArray(remoteConfig.disabledModules)) {
                remoteConfig.disabledModules.forEach(modId => {
                    const mod = MODULES.find(m => m.id === modId);
                    if (mod) mod.enabled = false; // تعطيل الكتلة محلياً بناءً على أمر السيرفر
                });
            }

        } catch (e) {
            console.log("تعذر الاتصال بخادم الإعدادات ، العمل بالإعدادات المحلية.");
        }
        return true;
    }

    function showUpdateNotification(updateUrl, isForce) {
        if (document.getElementById('nippur-update-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'nippur-update-banner';
        banner.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; z-index: 9999999;
            background: ${isForce ? '#dc2626' : '#2563eb'}; color: #fff; padding: 12px 18px;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: sans-serif;
            font-size: 13px; direction: rtl; display: flex; align-items: center; gap: 12px;
        `;
        banner.innerHTML = `
            <span>${isForce ? '⚠️ توفر تحديث إجباري هام للسكربت!' : '✨ توفر تحديث جديد للسكربت.'}</span>
            <a href="${updateUrl}" target="_blank" style="background:#fff; color:${isForce ? '#dc2626' : '#2563eb'}; padding:4px 10px; border-radius:4px; font-weight:bold; text-decoration:none;">تحديث الآن</a>
            ${!isForce ? '<span id="close-update" style="cursor:pointer; margin-right:8px;">✕</span>' : ''}
        `;
        document.body.appendChild(banner);
        const closeBtn = document.getElementById('close-update');
        if (closeBtn) closeBtn.onclick = () => banner.remove();
    }

    // =========================================================================
    // 2. سجل الكتل الفرعية (Modules Registry)
    // =========================================================================
    const MODULES = [

        // --- [كتلة 1: نسخ الطلب] ---
        {
            id: 'copyOrder',
            name: 'نسخ الطلب',
            enabled: true,
            matchUrl: /\/admin\/orders\/\d+/,
            options: {
                includeOrderNum: { type: 'boolean', label: 'تضمين رقم الطلب', value: true },
                includeItemNotes: { type: 'boolean', label: 'تضمين ملاحظات المنتجات', value: true },
                includeGeneralNotes: { type: 'boolean', label: 'تضمين الملاحظات العامة', value: true },
                customPrefix: { type: 'text', label: 'بادئة النص', value: '' }
            },
            run: function (opts) {
                if (!document.getElementById('copy-order-btn')) {
                    const backLink = Array.from(document.querySelectorAll('a')).find(el => el.textContent.includes('رجوع للقائمة'));
                    if (backLink && backLink.parentElement) {
                        const parentContainer = backLink.parentElement;
                        const copyBtn = document.createElement('button');
                        copyBtn.id = 'copy-order-btn';
                        copyBtn.type = 'button';
                        copyBtn.className = 'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition shadow-sm mr-2 ml-2';
                        copyBtn.style.cursor = 'pointer';
                        copyBtn.innerHTML = `
                            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                            </svg>
                            <span>نسخ الطلب</span>
                        `;

                        parentContainer.insertBefore(copyBtn, backLink);

                        copyBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            let textToCopy = '';

                            if (opts.customPrefix.value && opts.customPrefix.value.trim() !== '') {
                                textToCopy += opts.customPrefix.value.trim() + '\n';
                            }

                            if (opts.includeOrderNum.value) {
                                const h1El = document.querySelector('h1');
                                if (h1El) {
                                    const match = h1El.innerText.match(/ORD-[\w-]+/);
                                    if (match) textToCopy += `رقم الطلب: ${match[0]}\n\n`;
                                }
                            }

                            const itemRows = document.querySelectorAll('div.py-2.border-b');
                            let itemsList = [];
                            itemRows.forEach(row => {
                                const itemSpan = row.querySelector('span.font-medium');
                                if (itemSpan) {
                                    let itemText = itemSpan.innerText.trim();
                                    if (opts.includeItemNotes.value) {
                                        const noteDiv = row.querySelector('.text-xs.text-amber-600');
                                        if (noteDiv) {
                                            itemText += `\n  ↲ (${noteDiv.innerText.trim()})`;
                                        }
                                    }
                                    itemsList.push(itemText);
                                }
                            });

                            textToCopy += itemsList.join('\n') + '\n';

                            if (opts.includeGeneralNotes.value) {
                                const generalNotesDiv = Array.from(document.querySelectorAll('div')).find(el => el.classList.contains('text-amber-600') && el.textContent.includes('ملاحظات:'));
                                if (generalNotesDiv) {
                                    const generalNoteText = generalNotesDiv.innerText.trim();
                                    if (generalNoteText) {
                                        textToCopy += `\n📌 ${generalNoteText}\n`;
                                    }
                                }
                            }

                            navigator.clipboard.writeText(textToCopy).then(() => {
                                const originalHTML = copyBtn.innerHTML;
                                copyBtn.innerHTML = `<span>✓ تم النسخ!</span>`;
                                copyBtn.style.backgroundColor = '#10B981';
                                setTimeout(() => {
                                    copyBtn.innerHTML = originalHTML;
                                    copyBtn.style.backgroundColor = '';
                                }, 2000);
                            }).catch(err => {
                                alert('فشل النسخ: ' + err);
                            });
                        });
                    }
                }
            }
        },

        // --- [كتلة 2: فحص الزبون] ---
        {
            id: 'customerVerify',
            name: 'فحص الزبون',
            enabled: true,
            matchUrl: /\/admin\/orders\/\d+/,
            options: {
                autoRun: { type: 'boolean', label: 'فحص تلقائي عند فتح الصفحة', value: true },
                showWhatsAppBtn: { type: 'boolean', label: 'إظهار زر مراسلة واتساب (دائماً)', value: true },
                showCopyBtnForUnverified: { type: 'boolean', label: 'إظهار زر نسخ الطلب (للغير موثقين فقط)', value: true }
            },
            run: function (opts) {
                if (!opts.autoRun.value) return;

                const customerCardHeader = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('الزبون'));
                if (customerCardHeader) {
                    const cardParent = customerCardHeader.closest('div');
                    if (cardParent) {
                        const nameDiv = cardParent.querySelector('.text-sm.text-gray-600');
                        const phoneDiv = cardParent.querySelector('.text-xs.text-gray-400.ltr');

                        if (nameDiv && phoneDiv) {
                            const phone = phoneDiv.innerText.trim();
                            const customerName = nameDiv.childNodes[0] ? nameDiv.childNodes[0].nodeValue.trim() : "غير معروف";

                            if (phone) {
                                this.initCustomerActions(cardParent, phone, customerName, opts);

                                if (!document.getElementById('customer-verification-badge')) {
                                    this.verify(phone, nameDiv, cardParent, opts);
                                }
                            }
                        }
                    }
                }
            },
            initCustomerActions: function (cardParent, phone, customerName, opts) {
                if (document.getElementById('customer-actions-container')) return;

                let cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '964' + cleanPhone.substring(1);
                }

                const actionDiv = document.createElement('div');
                actionDiv.id = 'customer-actions-container';
                actionDiv.style.cssText = 'margin-top: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-top: 1px dashed #e5e7eb; padding-top: 10px;';

                if (opts.showWhatsAppBtn.value) {
                    const waLink = document.createElement('a');
                    waLink.href = `https://wa.me/${cleanPhone}`;
                    waLink.target = '_blank';
                    waLink.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background-color: #059669; color: #ffffff !important; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;';
                    waLink.innerHTML = `
                        <svg style="width:14px;height:14px; fill:currentColor;" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                        <span>مراسلة واتساب</span>
                    `;
                    actionDiv.appendChild(waLink);
                }

                if (opts.showCopyBtnForUnverified.value) {
                    const copyFullBtn = document.createElement('button');
                    copyFullBtn.id = 'unverified-copy-btn';
                    copyFullBtn.type = 'button';
                    copyFullBtn.style.cssText = 'display: none; align-items: center; gap: 6px; background-color: #d97706; color: #ffffff !important; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;';
                    copyFullBtn.innerHTML = `
                        <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                        </svg>
                        <span>نسخ الطلب (للتحقق)</span>
                    `;

                    copyFullBtn.addEventListener('click', () => {
                        let fullText = `👤 اسم الزبون: ${customerName}\n📞 رقم الهاتف: ${phone}\n\n--- تفاصيل الطلب ---\n`;

                        const h1El = document.querySelector('h1');
                        if (h1El) {
                            const match = h1El.innerText.match(/ORD-[\w-]+/);
                            if (match) fullText = `رقم الطلب: ${match[0]}\n` + fullText;
                        }

                        const itemRows = document.querySelectorAll('div.py-2.border-b');
                        itemRows.forEach(row => {
                            const itemSpan = row.querySelector('span.font-medium');
                            if (itemSpan) {
                                let itemText = itemSpan.innerText.trim();
                                const noteDiv = row.querySelector('.text-xs.text-amber-600');
                                if (noteDiv) itemText += ` (${noteDiv.innerText.trim()})`;
                                fullText += `• ${itemText}\n`;
                            }
                        });

                        const generalNotesDiv = Array.from(document.querySelectorAll('div')).find(el => el.classList.contains('text-amber-600') && el.textContent.includes('ملاحظات:'));
                        if (generalNotesDiv) {
                            fullText += `\n📌 ${generalNotesDiv.innerText.trim()}\n`;
                        }

                        navigator.clipboard.writeText(fullText).then(() => {
                            const origHTML = copyFullBtn.innerHTML;
                            copyFullBtn.innerHTML = `<span>✓ تم النسخ!</span>`;
                            copyFullBtn.style.backgroundColor = '#10B981';
                            setTimeout(() => {
                                copyFullBtn.innerHTML = origHTML;
                                copyFullBtn.style.backgroundColor = '#d97706';
                            }, 2000);
                        });
                    });

                    actionDiv.appendChild(copyFullBtn);
                }

                cardParent.appendChild(actionDiv);
            },
            verify: async function (phone, customerNameEl, cardParent, opts) {
                let badgeEl = document.getElementById('customer-verification-badge');
                if (!badgeEl) {
                    badgeEl = document.createElement('span');
                    badgeEl.id = 'customer-verification-badge';
                    badgeEl.className = 'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium mr-2 bg-gray-100 text-gray-500 animate-pulse';
                    badgeEl.innerText = '⏳ جاري التحقق...';
                    customerNameEl.appendChild(badgeEl);
                }

                try {
                    const searchUrl = `https://nippurconnect.com/admin/orders?q=${encodeURIComponent(phone)}&status=&type=&governorate=&store_id=&driver_user_id=&from=&to=`;
                    const response = await fetch(searchUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'include'
                    });

                    if (!response.ok) throw new Error('فشل الاتصال بالخادم');
                    const htmlText = await response.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                    const rows = doc.querySelectorAll('table tbody tr');

                    let totalOrders = rows.length;
                    let deliveredCount = 0;
                    rows.forEach(row => {
                        const badge = row.querySelector('td:nth-child(8) span.badge');
                        if (badge && badge.innerText.includes('تم التوصيل')) deliveredCount++;
                    });

                    let isVerified = (totalOrders > 1 && deliveredCount > 0) || (totalOrders === 1 && deliveredCount > 0);
                    let labelText = '';
                    let badgeClass = '';

                    const copyBtn = document.getElementById('unverified-copy-btn');

                    if (isVerified) {
                        labelText = '✓ موثق';
                        badgeClass = 'bg-green-50 text-green-700 border border-green-200';
                        badgeEl.className = `inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium mr-2 ${badgeClass}`;
                        badgeEl.innerText = labelText;

                        if (copyBtn) copyBtn.style.display = 'none';
                    } else {
                        labelText = '⚠ غير موثق (يحتاج تحقق)';
                        badgeClass = 'bg-red-50 text-red-700 border border-red-200';
                        badgeEl.className = `inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium mr-2 ${badgeClass}`;
                        badgeEl.innerText = labelText;

                        if (copyBtn && opts.showCopyBtnForUnverified.value) {
                            copyBtn.style.display = 'inline-flex';
                        }
                    }
                } catch (err) {
                    badgeEl.className = 'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium mr-2 bg-amber-50 text-amber-700';
                    badgeEl.innerText = '⚠ خطأ في التحقق';
                }
            }
        },

        // --- [كتلة 3: نسخ سجل الحالات] ---
        {
            id: 'copyStatusLogs',
            name: 'نسخ سجل الحالات',
            enabled: true,
            matchUrl: /\/admin\/orders\/\d+/,
            options: {
                includeTimeFormat: { type: 'boolean', label: 'تحويل الوقت إلى نظام 12 ساعة (ص/م)', value: true }
            },
            run: function (opts) {
                const statusHeader = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('سجل الحالات'));
                if (statusHeader && !document.getElementById('copy-logs-btn')) {
                    const cardCard = statusHeader.closest('.card');
                    if (cardCard) {
                        cardCard.style.display = 'flex';
                        cardCard.style.justifyContent = 'space-between';
                        cardCard.style.alignItems = 'center';
                        cardCard.style.flexWrap = 'wrap';

                        const copyLogsBtn = document.createElement('button');
                        copyLogsBtn.id = 'copy-logs-btn';
                        copyLogsBtn.type = 'button';
                        copyLogsBtn.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; background-color: #2563eb; color: #ffffff !important; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; border: none; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); height: fit-content;';
                        copyLogsBtn.innerHTML = `
                            <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                            </svg>
                            <span>نسخ السجل</span>
                        `;

                        cardCard.appendChild(copyLogsBtn);

                        copyLogsBtn.addEventListener('click', () => {
                            const logRows = cardCard.querySelectorAll('.space-y-3 > div');
                            let logsText = '📋 سجل حالات الطلب:\n------------------------\n';

                            logRows.forEach(row => {
                                const titleEl = row.querySelector('.font-medium.text-gray-700');
                                const descEl = row.querySelector('.text-xs.text-gray-500');
                                const dateEl = row.querySelector('.text-xs.text-gray-400');

                                if (titleEl) {
                                    const statusTitle = titleEl.innerText.trim();
                                    const statusDesc = descEl ? descEl.innerText.trim() : '';
                                    let dateText = dateEl ? dateEl.innerText.trim() : '';

                                    if (dateText && opts.includeTimeFormat.value) {
                                        const dateRegex = /(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/;
                                        const match = dateText.match(dateRegex);

                                        if (match) {
                                            const datePart = match[1];
                                            let hours = parseInt(match[2], 10);
                                            const minutes = match[3];

                                            const ampm = hours >= 12 ? 'م' : 'ص';
                                            hours = hours % 12;
                                            hours = hours ? hours : 12;
                                            const formattedHours = hours < 10 ? '0' + hours : hours;

                                            const time12Str = `${datePart} ${formattedHours}:${minutes} ${ampm}`;
                                            dateText = dateText.replace(dateRegex, time12Str);
                                        }
                                    }

                                    logsText += `• ${statusTitle}`;
                                    if (statusDesc) {
                                        logsText += `\n  📝 ${statusDesc}`;
                                    }
                                    if (dateText) {
                                        logsText += `\n  🕒 ${dateText}`;
                                    }
                                    logsText += `\n------------------------\n`;
                                }
                            });

                            navigator.clipboard.writeText(logsText.trim()).then(() => {
                                const origHTML = copyLogsBtn.innerHTML;
                                copyLogsBtn.innerHTML = `<span>✓ تم النسخ!</span>`;
                                copyLogsBtn.style.backgroundColor = '#10B981';
                                setTimeout(() => {
                                    copyLogsBtn.innerHTML = origHTML;
                                    copyLogsBtn.style.backgroundColor = '#2563eb';
                                }, 2000);
                            });
                        });
                    }
                }
            }
        },

        // --- [كتلة 4: تنبيه استلام من المتجر] ---
        {
            id: 'pickupAlert',
            name: 'تنبيه استلام من المتجر',
            enabled: true,
            matchUrl: /\/admin\/orders\/\d+/,
            options: {
                alertMessage: { type: 'text', label: 'نص التنبيه', value: '⚠️ تنبيه مهم: هذا الطلب (استلام من المتجر) وليس توصيل!' }
            },
            run: function (opts) {
                const typeSelect = document.querySelector('select[name="type"]');
                if (!typeSelect) return;

                const selectedType = typeSelect.value;
                const changeStatusHeader = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('تغيير الحالة'));
                if (!changeStatusHeader) return;

                const statusCard = changeStatusHeader.closest('.card');
                if (!statusCard) return;

                const existingAlert = document.getElementById('nippur-pickup-alert-box');

                if (selectedType === 'pickup') {
                    if (!existingAlert) {
                        const alertBox = document.createElement('div');
                        alertBox.id = 'nippur-pickup-alert-box';
                        alertBox.style.cssText = `
                            background-color: #fffbeb;
                            border: 2px dashed #f59e0b;
                            color: #b45309;
                            padding: 10px 14px;
                            border-radius: 8px;
                            font-size: 12px;
                            font-weight: bold;
                            margin-bottom: 12px;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                        `;

                        alertBox.innerHTML = `
                            <span style="font-size: 16px;">🚨</span>
                            <span>${opts.alertMessage.value || 'تنبيه مهم: هذا الطلب (استلام من المتجر) وليس توصيل!'}</span>
                        `;

                        const formEl = statusCard.querySelector('form');
                        if (formEl) {
                            statusCard.insertBefore(alertBox, formEl);
                        }
                    }
                } else {
                    if (existingAlert) {
                        existingAlert.remove();
                    }
                }
            }
        },

        // --- [كتلة: سجل الزبون الشامل والتابات المتقدمة - مع فلترة التواريخ والفترات الجاهزة] ---
        {
            id: 'customerAllOrdersModal',
            name: 'سجل الزبون الشامل',
            enabled: true,
            matchUrl: /\/admin\/orders/,
            options: {
                buttonText: { type: 'text', label: 'نص الزر', value: 'سجل الزبون' }
            },
            run: function (opts) {
                const orderRows = document.querySelectorAll('table.table-modern tbody tr');

                orderRows.forEach(row => {
                    const actionCell = row.querySelector('td.text-left');
                    if (actionCell && !row.querySelector('.nippur-customer-log-btn')) {

                        const phoneDiv = row.querySelector('td.text-gray-600 div.text-xs.text-gray-400.ltr');
                        if (!phoneDiv) return;

                        const customerPhone = phoneDiv.innerText.trim();
                        if (!customerPhone) return;

                        const customerCell = row.querySelector('td.text-gray-600');
                        let customerName = "مشترك";
                        if (customerCell) {
                            customerName = customerCell.childNodes[0].nodeValue ? customerCell.childNodes[0].nodeValue.trim() : "مشترك";
                        }

                        const logBtn = document.createElement('button');
                        logBtn.type = 'button';
                        logBtn.className = 'nippur-customer-log-btn btn btn-soft !py-1 !px-2.5 text-xs';
                        logBtn.innerText = opts.buttonText.value || 'سجل الزبون';

                        logBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            await this.openCustomerModal(customerPhone, customerName);
                        });

                        actionCell.appendChild(logBtn);
                    }
                });
            },

            openCustomerModal: async function (phone, customerName) {
                let modal = document.getElementById('nippur-customer-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'nippur-customer-modal';
                    modal.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(20, 20, 25, 0.65); backdrop-filter: blur(4px); z-index: 999999; display: flex;
                        align-items: center; justify-content: center; font-family: var(--default-font-family);
                        direction: rtl; padding: 20px;
                    `;
                    document.body.appendChild(modal);
                }

                const firstLetter = customerName ? customerName.charAt(0) : "م";

                modal.innerHTML = `
                    <div id="cust-modal-content-box" class="dash" style="background: var(--color-white); width: 100%; max-width: 1250px; border-radius: var(--radius-2xl); box-shadow: var(--shadow-card); height: 90vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-gray-200);">

                        <!-- شريط العناوين العلوي -->
                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-gray-50); border-bottom: 1px solid var(--color-gray-200); padding: 12px 20px;">
                            <h3 style="font-weight: 700; font-size: 1rem; color: var(--color-ink-900); margin: 0;">📦 لوحة إدارة وسجل طلبات الزبون</h3>
                            <button id="close-cust-modal" class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: var(--radius-md);">✕ إغلاق</button>
                        </div>

                        <!-- هيكل التقسيم -->
                        <div style="display: flex; flex: 1; overflow: hidden;">

                            <!-- القسم الأيمن: بطاقة الزبون، رقمه، والتابات الجانبية -->
                            <div style="width: 280px; background: var(--color-gray-50); border-left: 1px solid var(--color-gray-200); padding: 20px 14px; display: flex; flex-direction: column; overflow-y: auto;">
                                <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 16px;">
                                    <div style="width: 72px; height: 72px; border-radius: 9999px; background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700)); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; box-shadow: var(--shadow-brand); margin-bottom: 10px;">
                                        ${firstLetter}
                                    </div>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-ink-900); margin-bottom: 4px;">${customerName}</div>
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-brand-600); direction: ltr; margin-bottom: 6px;">${phone}</div>
                                    <span style="background: var(--color-emerald-100); color: var(--color-emerald-800); font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">CUSTOMER</span>
                                </div>

                                <div style="border-top: 1px solid var(--color-gray-200); margin-bottom: 16px;"></div>

                                <!-- التابات الجانبية -->
                                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                                    <button class="modal-tab-btn" data-tab="orders" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-brand-300); color: var(--color-brand-700); border-radius: var(--radius-lg); font-weight: 700; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>سجل الطلبات والفلترة</span>
                                        <span>‹</span>
                                    </button>
                                    <button class="modal-tab-btn" data-tab="info" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-gray-200); color: var(--color-gray-700); border-radius: var(--radius-lg); font-weight: 600; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>معلومات الزبون</span>
                                        <span>‹</span>
                                    </button>
                                    <button class="modal-tab-btn" data-tab="tickets" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-gray-200); color: var(--color-gray-700); border-radius: var(--radius-lg); font-weight: 600; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>تذاكر الدعم الفني</span>
                                        <span>‹</span>
                                    </button>
                                </div>
                            </div>

                            <!-- القسم الأيسر: محتوى التابات -->
                            <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; overflow: hidden; background: #fff;">

                                <!-- التاب الأول: سجل الطلبات والفلاتر -->
                                <div id="tab-content-orders" class="tab-pane" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                                    <div style="background: var(--color-gray-50); border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl); padding: 12px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; align-items: flex-end;">
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">فترة جاهزة</label>
                                            <select id="filter-quick-date" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">فترة مخصصة</option>
                                                <option value="today">طلبات اليوم</option>
                                                <option value="yesterday">طلبات البارحة</option>
                                                <option value="7days">آخر 7 أيام</option>
                                                <option value="30days">آخر 30 يوماً</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">من تاريخ</label>
                                            <input type="date" id="filter-from-date" style="font-size: 0.8rem; padding: 0.35rem; width: 100%; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md);">
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">إلى تاريخ</label>
                                            <input type="date" id="filter-to-date" style="font-size: 0.8rem; padding: 0.35rem; width: 100%; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md);">
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">الحالة</label>
                                            <select id="filter-status" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل الحالات</option>
                                                <option value="pending">قيد الانتظار</option>
                                                <option value="accepted">مقبول</option>
                                                <option value="rejected">مرفوض</option>
                                                <option value="preparing">قيد التحضير</option>
                                                <option value="ready">جاهز</option>
                                                <option value="assigned">تم تعيين سائق</option>
                                                <option value="picked_up">تم الاستلام</option>
                                                <option value="on_the_way">في الطريق</option>
                                                <option value="delivered">تم التوصيل</option>
                                                <option value="completed">مكتمل</option>
                                                <option value="cancelled">ملغي</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">النوع</label>
                                            <select id="filter-type" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل الأنواع</option>
                                                <option value="delivery">توصيل</option>
                                                <option value="pickup">استلام من المتجر</option>
                                                <option value="dine_in">صالة (طاولة)</option>
                                                <option value="takeaway">سفري</option>
                                                <option value="peer_delivery">طلبي (توصيل بين الأشخاص)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">المحافظة</label>
                                            <select id="filter-governorate" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل المحافظات</option>
                                                <option value="بغداد">بغداد</option><option value="البصرة">البصرة</option><option value="نينوى">نينوى</option><option value="أربيل">أربيل</option><option value="النجف">النجف</option><option value="كربلاء">كربلاء</option><option value="كركوك">كركوك</option><option value="الأنبار">الأنبار</option><option value="ديالى">ديالى</option><option value="ذي قار">ذي قار</option><option value="بابل">بابل</option><option value="واسط">واسط</option><option value="صلاح الدين">صلاح الدين</option><option value="القادسية">القادسية</option><option value="ميسان">ميسان</option><option value="المثنى">المثنى</option><option value="دهوك">دهوك</option><option value="السليمانية">السليمانية</option><option value="حلبجة">حلبجة</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">المتجر</label>
                                            <select id="filter-store" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل المتاجر</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">السائق</label>
                                            <select id="filter-driver" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل السائقين</option>
                                            </select>
                                        </div>
                                        <div>
                                            <button id="apply-filter-btn" type="button" class="btn btn-primary" style="width: 100%; padding: 0.45rem; font-size: 0.75rem;">تطبيق الفلتر</button>
                                        </div>
                                    </div>

                                    <div id="cust-modal-body" style="overflow-y: auto; flex: 1; text-align: center; padding: 10px; color: var(--color-gray-600);">
                                        ⏳ جاري جلب كافة طلبات الزبون...
                                    </div>
                                </div>

                                <!-- التاب الثاني: معلومات الزبون والتفاصيل -->
                                <div id="tab-content-info" class="tab-pane" style="display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 10px;">
                                    <div id="customer-info-body" style="text-align: center; color: var(--color-gray-600); padding: 40px;">
                                        ⏳ جاري جلب بيانات وحساب الزبون...
                                    </div>
                                </div>

                                <!-- التاب الثالث: التذاكر -->
                                <div id="tab-content-tickets" class="tab-pane" style="display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 10px;">
                                    <div id="customer-tickets-body" style="text-align: center; color: var(--color-gray-600); padding: 40px;">
                                        ⏳ جاري جلب تذاكر الدعم الفني للمشترك...
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                `;

                document.getElementById('close-cust-modal').addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

                // تفعيل اختيار الفترات الجاهزة وتعبئة التواريخ تلقائياً
                const quickDateSelect = document.getElementById('filter-quick-date');
                quickDateSelect.addEventListener('change', () => {
                    const val = quickDateSelect.value;
                    const today = new Date();
                    const formatDate = (d) => d.toISOString().split('T')[0];

                    let fromStr = '';
                    let toStr = formatDate(today);

                    if (val === 'today') {
                        fromStr = toStr;
                    } else if (val === 'yesterday') {
                        const yest = new Date();
                        yest.setDate(today.getDate() - 1);
                        fromStr = formatDate(yest);
                        toStr = fromStr;
                    } else if (val === '7days') {
                        const past = new Date();
                        past.setDate(today.getDate() - 7);
                        fromStr = formatDate(past);
                    } else if (val === '30days') {
                        const past = new Date();
                        past.setDate(today.getDate() - 30);
                        fromStr = formatDate(past);
                    } else {
                        fromStr = '';
                        toStr = '';
                    }

                    document.getElementById('filter-from-date').value = fromStr;
                    document.getElementById('filter-to-date').value = toStr;
                });

                // تفعيل التبديل بين التابات
                const tabBtns = modal.querySelectorAll('.modal-tab-btn');
                tabBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        tabBtns.forEach(b => {
                            b.style.background = 'var(--color-white)';
                            b.style.color = 'var(--color-gray-700)';
                            b.style.borderColor = 'var(--color-gray-200)';
                            b.style.fontWeight = '600';
                        });
                        btn.style.background = 'var(--color-white)';
                        btn.style.color = 'var(--color-brand-700)';
                        btn.style.borderColor = 'var(--color-brand-300)';
                        btn.style.fontWeight = '700';

                        const targetTab = btn.getAttribute('data-tab');
                        modal.querySelectorAll('.tab-pane').forEach(pane => pane.style.display = 'none');
                        const targetPane = document.getElementById(`tab-content-${targetTab}`);
                        if (targetPane) targetPane.style.display = 'flex';
                    });
                });

                this.populateDropdowns();
                this.loadCustomerDetails(phone);
                this.loadCustomerTickets(phone);

                const applyBtn = document.getElementById('apply-filter-btn');
                const newApplyBtn = applyBtn.cloneNode(true);
                applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);

                newApplyBtn.addEventListener('click', async () => {
                    const status = document.getElementById('filter-status').value;
                    const type = document.getElementById('filter-type').value;
                    const governorate = document.getElementById('filter-governorate').value;
                    const store_id = document.getElementById('filter-store').value;
                    const driver_user_id = document.getElementById('filter-driver').value;
                    const fromDate = document.getElementById('filter-from-date').value;
                    const toDate = document.getElementById('filter-to-date').value;

                    const params = `&status=${status}&type=${type}&governorate=${encodeURIComponent(governorate)}&store_id=${store_id}&driver_user_id=${driver_user_id}&from=${fromDate}&to=${toDate}`;
                    await this.loadAndRenderOrders(phone, params);
                });

                await this.loadAndRenderOrders(phone, '');
            },

            loadCustomerDetails: async function (phone) {
                const infoBody = document.getElementById('customer-info-body');
                try {
                    const searchRes = await fetch(`https://nippurconnect.com/admin/users?q=${encodeURIComponent(phone)}&role=&governorate=`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (!searchRes.ok) throw new Error('فشل جلب بيانات المستخدم');
                    const htmlText = await searchRes.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                    const editLink = doc.querySelector('a[href*="/admin/users/"][href*="/edit"]');
                    if (!editLink) {
                        infoBody.innerHTML = '<p style="color: var(--color-red-600); font-weight: 600;">لم يتم العثور على ملف تعريف لهذا المستخدم في نظام المستخدمين.</p>';
                        return;
                    }

                    const editUrl = editLink.href;
                    const userRow = editLink.closest('tr');
                    let statusBadgeHTML = '—';
                    let rolesHTML = '—';
                    if (userRow) {
                        const tds = userRow.querySelectorAll('td');
                        if (tds.length >= 5) {
                            rolesHTML = tds[3].innerHTML;
                            statusBadgeHTML = tds[4].innerHTML;
                        }
                    }

                    const editRes = await fetch(editUrl);
                    if (!editRes.ok) throw new Error('فشل جلب تفاصيل العنوان');
                    const editHtmlText = await editRes.text();
                    const editDoc = new DOMParser().parseFromString(editHtmlText, 'text/html');

                    const fullAddress = editDoc.querySelector('input[name="address[full_address]"]')?.value || '—';
                    const city = editDoc.querySelector('input[name="address[city]"]')?.value || '—';
                    const area = editDoc.querySelector('input[name="address[area]"]')?.value || '—';
                    const building = editDoc.querySelector('input[name="address[building]"]')?.value || '—';
                    const floor = editDoc.querySelector('input[name="address[floor]"]')?.value || '—';
                    const addressPhone = editDoc.querySelector('input[name="address[phone]"]')?.value || phone;
                    const notes = editDoc.querySelector('input[name="address[notes]"]')?.value || '—';

                    infoBody.innerHTML = `
                        <div style="text-align: right; display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 10px;">
                                <h4 style="font-weight: 700; font-size: 0.95rem; color: var(--color-ink-900); margin: 0;">معلومات الحساب والأدوار</h4>
                                <div>${statusBadgeHTML}</div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-xl); border: 1px solid var(--color-gray-200);">
                                <div>
                                    <span style="font-size: 0.75rem; color: var(--color-gray-500); display: block; margin-bottom: 2px;">الأدوار والصلاحيات:</span>
                                    <div>${rolesHTML}</div>
                                </div>
                                <div>
                                    <span style="font-size: 0.75rem; color: var(--color-gray-500); display: block; margin-bottom: 2px;">رقم الهاتف الرئيسي:</span>
                                    <span style="font-weight: 700; direction: ltr; display: inline-block;">${phone}</span>
                                </div>
                            </div>

                            <h4 style="font-weight: 700; font-size: 0.95rem; color: var(--color-ink-900); margin-top: 10px; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 10px;">تفاصيل العنوان</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">العنوان التفصيلي</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${fullAddress}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المدينة</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${city}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المنطقة / الحي</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${area}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المبنى</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${building || '—'}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">الطابق</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${floor || '—'}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">هاتف العنوان</span>
                                    <span style="font-weight: 600; color: var(--color-brand-600); font-size: 0.85rem; direction: ltr; display: inline-block;">${addressPhone}</span>
                                </div>
                            </div>
                            <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 12px 14px; border-radius: var(--radius-lg); margin-top: 4px;">
                                <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">ملاحظات العنوان</span>
                                <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${notes || '—'}</span>
                            </div>
                        </div>
                    `;

                } catch (err) {
                    infoBody.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ أثناء جلب معلومات الزبون: ${err.message}</p>`;
                }
            },

            loadCustomerTickets: async function (phone) {
                const ticketsBody = document.getElementById('customer-tickets-body');
                try {
                    const res = await fetch(`https://nippurconnect.com/admin/support?q=${encodeURIComponent(phone)}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (!res.ok) throw new Error('فشل جلب تذاكر الدعم الفني');
                    const htmlText = await res.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                    const table = doc.querySelector('table.table-modern');
                    if (!table) {
                        ticketsBody.innerHTML = '<p style="color: var(--color-gray-500); font-weight: 600; padding: 20px;">لا توجد تذاكر دعم فني مسجلة لهذا الزبون.</p>';
                        return;
                    }

                    ticketsBody.innerHTML = `
                        <div style="overflow-x: auto; border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl);">
                            ${table.outerHTML}
                        </div>
                    `;
                } catch (err) {
                    ticketsBody.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ أثناء جلب التذاكر: ${err.message}</p>`;
                }
            },

            populateDropdowns: async function () {
                try {
                    const res = await fetch('https://nippurconnect.com/admin/orders');
                    if (!res.ok) return;
                    const html = await res.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');

                    const storeSelect = doc.querySelector('select[name="store_id"]');
                    if (storeSelect) {
                        document.getElementById('filter-store').innerHTML = storeSelect.innerHTML;
                    }

                    const driverSelect = doc.querySelector('select[name="driver_user_id"]');
                    if (driverSelect) {
                        document.getElementById('filter-driver').innerHTML = driverSelect.innerHTML;
                    }
                } catch (e) {
                    console.error("فشل جلب خيارات المتاجر والسائقين", e);
                }
            },

            loadAndRenderOrders: async function (phone, extraParams = '') {
                const bodyContainer = document.getElementById('cust-modal-body');
                if (!bodyContainer) return;
                bodyContainer.innerHTML = '⏳ جاري جلب البيانات وتطبيق الفلتر...';

                try {
                    let allRowsHTML = [];
                    let currentPage = 1;
                    let hasMorePages = true;
                    let totalResultsFound = 0;

                    while (hasMorePages && currentPage <= 10) {
                        const searchUrl = `https://nippurconnect.com/admin/orders?q=${encodeURIComponent(phone)}&per_page=100&page=${currentPage}${extraParams}`;

                        const response = await fetch(searchUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            credentials: 'include'
                        });

                        if (!response.ok) break;
                        const htmlText = await response.text();
                        const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                        if (currentPage === 1) {
                            const pTags = doc.querySelectorAll('p');
                            pTags.forEach(p => {
                                if (p.textContent.includes('of') && p.textContent.includes('results')) {
                                    const match = p.textContent.match(/of\s+(\d+)\s+results/i);
                                    if (match) totalResultsFound = parseInt(match[1], 10);
                                }
                            });
                        }

                        const rows = doc.querySelectorAll('table.table-modern tbody tr');

                        if (rows.length > 0) {
                            rows.forEach(r => allRowsHTML.push(r.innerHTML));
                            if (allRowsHTML.length >= totalResultsFound || rows.length < 100) {
                                hasMorePages = false;
                            } else {
                                currentPage++;
                            }
                        } else {
                            hasMorePages = false;
                        }
                    }

                    if (allRowsHTML.length === 0) {
                        bodyContainer.innerHTML = '<p style="color: var(--color-red-600); font-weight: 600; padding: 20px;">لا توجد طلبات تطابق خيارات البحث الحالية لهذا الزبون.</p>';
                        return;
                    }

                    let tableHTML = `
                        <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-gray-700); margin-bottom: 10px; text-align: right; display: flex; justify-content: space-between; align-items: center;">
                            <span>النتائج المعروضة: <span style="color: var(--color-brand-600); font-size: 0.85rem;">${allRowsHTML.length}</span> طلب ${totalResultsFound ? '(من أصل ' + totalResultsFound + ')' : ''}</span>
                            <span style="font-size: 0.7rem; color: var(--color-emerald-700); background: var(--color-emerald-50); padding: 3px 8px; border-radius: var(--radius-md);">✓ تم جلب السجل بنجاح</span>
                        </div>
                        <div style="overflow-x: auto; max-height: 48vh; border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl);">
                            <table class="table-modern" style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.75rem;">
                                <thead style="position: sticky; top: 0; background: var(--color-gray-100); z-index: 10;">
                                    <tr style="color: var(--color-gray-700); border-bottom: 2px solid var(--color-gray-200);">
                                        <th style="padding: 8px;">الرقم</th>
                                        <th style="padding: 8px;">المتجر</th>
                                        <th style="padding: 8px;">السائق</th>
                                        <th style="padding: 8px;">النوع</th>
                                        <th style="padding: 8px;">الإجمالي</th>
                                        <th style="padding: 8px;">الدفع</th>
                                        <th style="padding: 8px;">الحالة</th>
                                        <th style="padding: 8px;">الوقت</th>
                                        <th style="padding: 8px;">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    allRowsHTML.forEach(rowInnerHtml => {
                        const tempTr = document.createElement('tr');
                        tempTr.innerHTML = rowInnerHtml;
                        const tds = tempTr.querySelectorAll('td');

                        if (tds.length >= 9) {
                            const orderNum = tds[0].innerHTML;
                            const storeName = tds[2].innerHTML;
                            const driverName = tds[3].innerHTML;
                            const typeBadge = tds[4].innerHTML;
                            const totalAmount = tds[5].innerHTML;
                            const paymentBadge = tds[6].innerHTML;
                            const statusBadge = tds[7].innerHTML;
                            const timeText = tds[8].innerHTML;
                            const actionLink = tds[9] ? tds[9].innerHTML : '';

                            tableHTML += `
                                <tr style="border-bottom: 1px solid var(--color-gray-100); background: #fff;" onmouseover="this.style.background='var(--color-gray-50)'" onmouseout="this.style.background='#fff'">
                                    <td style="padding: 8px; font-weight: 700; color: var(--color-ink-900);">${orderNum}</td>
                                    <td style="padding: 8px; color: var(--color-gray-700);">${storeName}</td>
                                    <td style="padding: 8px; color: var(--color-gray-700);">${driverName}</td>
                                    <td style="padding: 8px;">${typeBadge}</td>
                                    <td style="padding: 8px; font-weight: 700;">${totalAmount}</td>
                                    <td style="padding: 8px;">${paymentBadge}</td>
                                    <td style="padding: 8px;">${statusBadge}</td>
                                    <td style="padding: 8px; color: var(--color-gray-500); white-space: nowrap;">${timeText}</td>
                                    <td style="padding: 8px;">${actionLink}</td>
                                </tr>
                            `;
                        }
                    });

                    tableHTML += `
                                </tbody>
                            </table>
                        </div>
                    `;

                    bodyContainer.innerHTML = tableHTML;

                } catch (err) {
                    bodyContainer.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ أثناء جلب السجل: ${err.message}</p>`;
                }
            }
        },
        // --- [كتلة: نافذة تفاصيل وسجل المستخدم الشاملة في صفحة المستخدمين - مع فلترة التواريخ والفترات] ---
        {
            id: 'userManagementModal',
            name: 'سجل وتفاصيل المستخدم',
            enabled: true,
            matchUrl: /\/admin\/users/,
            options: {
                buttonText: { type: 'text', label: 'نص الزر', value: 'سجل المستخدم' }
            },
            run: function (opts) {
                const userRows = document.querySelectorAll('table.table-modern tbody tr');

                userRows.forEach(row => {
                    const actionCell = row.querySelector('td .flex.items-center.justify-end');
                    if (actionCell && !row.querySelector('.nippur-user-modal-btn')) {

                        const phoneTd = row.querySelectorAll('td')[2];
                        if (!phoneTd) return;

                        const userPhone = phoneTd.innerText.trim();
                        if (!userPhone) return;

                        const nameSpan = row.querySelector('td .font-medium');
                        let userName = nameSpan ? nameSpan.innerText.trim() : "مستخدم";

                        const modalBtn = document.createElement('button');
                        modalBtn.type = 'button';
                        modalBtn.className = 'nippur-user-modal-btn text-brand-600 hover:underline bg-transparent border-0 p-0 cursor-pointer text-xs font-medium ms-2';
                        modalBtn.innerText = opts.buttonText.value || 'سجل المستخدم';

                        modalBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            await this.openUserModal(userPhone, userName);
                        });

                        actionCell.prepend(modalBtn);
                    }
                });
            },

            openUserModal: async function (phone, userName) {
                let modal = document.getElementById('nippur-user-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'nippur-user-modal';
                    modal.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(20, 20, 25, 0.65); backdrop-filter: blur(4px); z-index: 999999; display: flex;
                        align-items: center; justify-content: center; font-family: var(--default-font-family);
                        direction: rtl; padding: 20px;
                    `;
                    document.body.appendChild(modal);
                }

                const firstLetter = userName ? userName.charAt(0) : "م";

                modal.innerHTML = `
                    <div id="user-modal-content-box" class="dash" style="background: var(--color-white); width: 100%; max-width: 1250px; border-radius: var(--radius-2xl); box-shadow: var(--shadow-card); height: 90vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-gray-200);">

                        <!-- شريط العناوين العلوي -->
                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-gray-50); border-bottom: 1px solid var(--color-gray-200); padding: 12px 20px;">
                            <h3 style="font-weight: 700; font-size: 1rem; color: var(--color-ink-900); margin: 0;">👤 لوحة إدارة وسجل المستخدم الشامل</h3>
                            <button id="close-user-modal" class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: var(--radius-md);">✕ إغلاق</button>
                        </div>

                        <!-- هيكل التقسيم -->
                        <div style="display: flex; flex: 1; overflow: hidden;">

                            <!-- القسم الأيمن: بطاقة المستخدم، رقمه الثابت، والتابات -->
                            <div style="width: 280px; background: var(--color-gray-50); border-left: 1px solid var(--color-gray-200); padding: 20px 14px; display: flex; flex-direction: column; overflow-y: auto;">
                                <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 16px;">
                                    <div style="width: 72px; height: 72px; border-radius: 9999px; background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700)); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; box-shadow: var(--shadow-brand); margin-bottom: 10px;">
                                        ${firstLetter}
                                    </div>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-ink-900); margin-bottom: 4px;">${userName}</div>
                                    <!-- رقم الهاتف الثابت أسفل الاسم -->
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-brand-600); direction: ltr; margin-bottom: 6px;">${phone}</div>
                                    <span style="background: var(--color-emerald-100); color: var(--color-emerald-800); font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">USER PROFILE</span>
                                </div>

                                <div style="border-top: 1px solid var(--color-gray-200); margin-bottom: 16px;"></div>

                                <!-- التابات الجانبية -->
                                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                                    <button class="user-modal-tab-btn" data-tab="orders" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-brand-300); color: var(--color-brand-700); border-radius: var(--radius-lg); font-weight: 700; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>سجل الطلبات والفلترة</span>
                                        <span>‹</span>
                                    </button>
                                    <button class="user-modal-tab-btn" data-tab="info" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-gray-200); color: var(--color-gray-700); border-radius: var(--radius-lg); font-weight: 600; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>معلومات المستخدم</span>
                                        <span>‹</span>
                                    </button>
                                    <button class="user-modal-tab-btn" data-tab="tickets" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-gray-200); color: var(--color-gray-700); border-radius: var(--radius-lg); font-weight: 600; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>تذاكر الدعم الفني</span>
                                        <span>‹</span>
                                    </button>
                                </div>
                            </div>

                            <!-- القسم الأيسر: محتوى التابات -->
                            <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; overflow: hidden; background: #fff;">

                                <!-- التاب الأول: سجل الطلبات -->
                                <div id="user-tab-content-orders" class="user-tab-pane" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                                    <div style="background: var(--color-gray-50); border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl); padding: 12px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; align-items: flex-end;">
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">فترة جاهزة</label>
                                            <select id="user-filter-quick-date" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">فترة مخصصة</option>
                                                <option value="today">طلبات اليوم</option>
                                                <option value="yesterday">طلبات البارحة</option>
                                                <option value="7days">آخر 7 أيام</option>
                                                <option value="30days">آخر 30 يوماً</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">من تاريخ</label>
                                            <input type="date" id="user-filter-from-date" style="font-size: 0.8rem; padding: 0.35rem; width: 100%; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md);">
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">إلى تاريخ</label>
                                            <input type="date" id="user-filter-to-date" style="font-size: 0.8rem; padding: 0.35rem; width: 100%; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md);">
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">الحالة</label>
                                            <select id="user-filter-status" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل الحالات</option>
                                                <option value="pending">قيد الانتظار</option>
                                                <option value="accepted">مقبول</option>
                                                <option value="rejected">مرفوض</option>
                                                <option value="preparing">قيد التحضير</option>
                                                <option value="ready">جاهز</option>
                                                <option value="assigned">تم تعيين سائق</option>
                                                <option value="picked_up">تم الاستلام</option>
                                                <option value="on_the_way">في الطريق</option>
                                                <option value="delivered">تم التوصيل</option>
                                                <option value="completed">مكتمل</option>
                                                <option value="cancelled">ملغي</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">النوع</label>
                                            <select id="user-filter-type" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل الأنواع</option>
                                                <option value="delivery">توصيل</option>
                                                <option value="pickup">استلام من المتجر</option>
                                                <option value="dine_in">صالة (طاولة)</option>
                                                <option value="takeaway">سفري</option>
                                                <option value="peer_delivery">طلبي (توصيل بين الأشخاص)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">المحافظة</label>
                                            <select id="user-filter-governorate" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل المحافظات</option>
                                                <option value="بغداد">بغداد</option><option value="البصرة">البصرة</option><option value="نينوى">نينوى</option><option value="أربيل">أربيل</option><option value="النجف">النجف</option><option value="كربلاء">كربلاء</option><option value="كركوك">كركوك</option><option value="الأنبار">الأنبار</option><option value="ديالى">ديالى</option><option value="ذي قار">ذي قار</option><option value="بابل">بابل</option><option value="واسط">واسط</option><option value="صلاح الدين">صلاح الدين</option><option value="القادسية">القادسية</option><option value="ميسان">ميسان</option><option value="المثنى">المثنى</option><option value="دهوك">دهوك</option><option value="السليمانية">السليمانية</option><option value="حلبجة">حلبجة</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">المتجر</label>
                                            <select id="user-filter-store" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل المتاجر</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">السائق</label>
                                            <select id="user-filter-driver" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل السائقين</option>
                                            </select>
                                        </div>
                                        <div>
                                            <button id="user-apply-filter-btn" type="button" class="btn btn-primary" style="width: 100%; padding: 0.45rem; font-size: 0.75rem;">تطبيق الفلتر</button>
                                        </div>
                                    </div>

                                    <div id="user-modal-body" style="overflow-y: auto; flex: 1; text-align: center; padding: 10px; color: var(--color-gray-600);">
                                        ⏳ جاري جلب كافة طلبات المستخدم...
                                    </div>
                                </div>

                                <!-- التاب الثاني: معلومات المستخدم -->
                                <div id="user-tab-content-info" class="user-tab-pane" style="display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 10px;">
                                    <div id="user-info-body" style="text-align: center; color: var(--color-gray-600); padding: 40px;">
                                        ⏳ جاري جلب بيانات وحساب المستخدم...
                                    </div>
                                </div>

                                <!-- التاب الثالث: التذاكر -->
                                <div id="user-tab-content-tickets" class="user-tab-pane" style="display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 10px;">
                                    <div id="user-tickets-body" style="text-align: center; color: var(--color-gray-600); padding: 40px;">
                                        ⏳ جاري جلب تذاكر الدعم الفني للمستخدم...
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                `;

                document.getElementById('close-user-modal').addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

                // تفعيل اختيار الفترات الجاهزة وتعبئة التواريخ تلقائياً
                const quickDateSelect = document.getElementById('user-filter-quick-date');
                quickDateSelect.addEventListener('change', () => {
                    const val = quickDateSelect.value;
                    const today = new Date();
                    const formatDate = (d) => d.toISOString().split('T')[0];

                    let fromStr = '';
                    let toStr = formatDate(today);

                    if (val === 'today') {
                        fromStr = toStr;
                    } else if (val === 'yesterday') {
                        const yest = new Date();
                        yest.setDate(today.getDate() - 1);
                        fromStr = formatDate(yest);
                        toStr = fromStr;
                    } else if (val === '7days') {
                        const past = new Date();
                        past.setDate(today.getDate() - 7);
                        fromStr = formatDate(past);
                    } else if (val === '30days') {
                        const past = new Date();
                        past.setDate(today.getDate() - 30);
                        fromStr = formatDate(past);
                    } else {
                        fromStr = '';
                        toStr = '';
                    }

                    document.getElementById('user-filter-from-date').value = fromStr;
                    document.getElementById('user-filter-to-date').value = toStr;
                });

                // تفعيل التنقل بين التابات
                const tabBtns = modal.querySelectorAll('.user-modal-tab-btn');
                tabBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        tabBtns.forEach(b => {
                            b.style.background = 'var(--color-white)';
                            b.style.color = 'var(--color-gray-700)';
                            b.style.borderColor = 'var(--color-gray-200)';
                            b.style.fontWeight = '600';
                        });
                        btn.style.background = 'var(--color-white)';
                        btn.style.color = 'var(--color-brand-700)';
                        btn.style.borderColor = 'var(--color-brand-300)';
                        btn.style.fontWeight = '700';

                        const targetTab = btn.getAttribute('data-tab');
                        modal.querySelectorAll('.user-tab-pane').forEach(pane => pane.style.display = 'none');
                        const targetPane = document.getElementById(`user-tab-content-${targetTab}`);
                        if (targetPane) targetPane.style.display = 'flex';
                    });
                });

                this.loadUserDetails(phone);
                this.loadUserTickets(phone);
                await this.loadUserOrders(phone, '');

                // تفعيل زر تطبيق الفلتر مع معاملات التواريخ
                const applyBtn = document.getElementById('user-apply-filter-btn');
                const newApplyBtn = applyBtn.cloneNode(true);
                applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);

                newApplyBtn.addEventListener('click', async () => {
                    const status = document.getElementById('user-filter-status').value;
                    const type = document.getElementById('user-filter-type').value;
                    const governorate = document.getElementById('user-filter-governorate').value;
                    const store_id = document.getElementById('user-filter-store').value;
                    const driver_user_id = document.getElementById('user-filter-driver').value;
                    const fromDate = document.getElementById('user-filter-from-date').value;
                    const toDate = document.getElementById('user-filter-to-date').value;

                    const params = `&status=${status}&type=${type}&governorate=${encodeURIComponent(governorate)}&store_id=${store_id}&driver_user_id=${driver_user_id}&from=${fromDate}&to=${toDate}`;
                    await this.loadUserOrders(phone, params);
                });
            },

            loadUserDetails: async function (phone) {
                const infoBody = document.getElementById('user-info-body');
                try {
                    const searchRes = await fetch(`https://nippurconnect.com/admin/users?q=${encodeURIComponent(phone)}&role=&governorate=`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (!searchRes.ok) throw new Error('فشل جلب بيانات المستخدم');
                    const htmlText = await searchRes.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                    const editLink = doc.querySelector('a[href*="/admin/users/"][href*="/edit"]');
                    if (!editLink) {
                        infoBody.innerHTML = '<p style="color: var(--color-red-600); font-weight: 600;">لم يتم العثور على ملف تعريف لهذا المستخدم.</p>';
                        return;
                    }

                    const editUrl = editLink.href;
                    const userRow = editLink.closest('tr');
                    let statusBadgeHTML = '—';
                    let rolesHTML = '—';
                    if (userRow) {
                        const tds = userRow.querySelectorAll('td');
                        if (tds.length >= 5) {
                            rolesHTML = tds[3].innerHTML;
                            statusBadgeHTML = tds[4].innerHTML;
                        }
                    }

                    const editRes = await fetch(editUrl);
                    if (!editRes.ok) throw new Error('فشل جلب تفاصيل العنوان');
                    const editHtmlText = await editRes.text();
                    const editDoc = new DOMParser().parseFromString(editHtmlText, 'text/html');

                    const fullAddress = editDoc.querySelector('input[name="address[full_address]"]')?.value || '—';
                    const city = editDoc.querySelector('input[name="address[city]"]')?.value || '—';
                    const area = editDoc.querySelector('input[name="address[area]"]')?.value || '—';
                    const building = editDoc.querySelector('input[name="address[building]"]')?.value || '—';
                    const floor = editDoc.querySelector('input[name="address[floor]"]')?.value || '—';
                    const addressPhone = editDoc.querySelector('input[name="address[phone]"]')?.value || phone;
                    const notes = editDoc.querySelector('input[name="address[notes]"]')?.value || '—';

                    infoBody.innerHTML = `
                        <div style="text-align: right; display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 10px;">
                                <h4 style="font-weight: 700; font-size: 0.95rem; color: var(--color-ink-900); margin: 0;">معلومات الحساب والأدوار</h4>
                                <div>${statusBadgeHTML}</div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-xl); border: 1px solid var(--color-gray-200);">
                                <div>
                                    <span style="font-size: 0.75rem; color: var(--color-gray-500); display: block; margin-bottom: 2px;">الأدوار والصلاحيات:</span>
                                    <div>${rolesHTML}</div>
                                </div>
                                <div>
                                    <span style="font-size: 0.75rem; color: var(--color-gray-500); display: block; margin-bottom: 2px;">رقم الهاتف الرئيسي:</span>
                                    <span style="font-weight: 700; direction: ltr; display: inline-block;">${phone}</span>
                                </div>
                            </div>

                            <h4 style="font-weight: 700; font-size: 0.95rem; color: var(--color-ink-900); margin-top: 10px; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 10px;">تفاصيل العنوان</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">العنوان التفصيلي</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${fullAddress}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المدينة</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${city}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المنطقة / الحي</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${area}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المبنى</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${building || '—'}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">الطابق</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${floor || '—'}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">هاتف العنوان</span>
                                    <span style="font-weight: 600; color: var(--color-brand-600); font-size: 0.85rem; direction: ltr; display: inline-block;">${addressPhone}</span>
                                </div>
                            </div>
                            <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 12px 14px; border-radius: var(--radius-lg); margin-top: 4px;">
                                <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">ملاحظات العنوان</span>
                                <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${notes || '—'}</span>
                            </div>
                        </div>
                    `;
                } catch (err) {
                    infoBody.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ أثناء جلب معلومات المستخدم: ${err.message}</p>`;
                }
            },

            loadUserTickets: async function (phone) {
                const ticketsBody = document.getElementById('user-tickets-body');
                try {
                    const res = await fetch(`https://nippurconnect.com/admin/support?q=${encodeURIComponent(phone)}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (!res.ok) throw new Error('فشل جلب التذاكر');
                    const htmlText = await res.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                    const table = doc.querySelector('table.table-modern');
                    if (!table) {
                        ticketsBody.innerHTML = '<p style="color: var(--color-gray-500); font-weight: 600; padding: 20px;">لا توجد تذاكر دعم فني مسجلة لهذا المستخدم.</p>';
                        return;
                    }

                    ticketsBody.innerHTML = `
                        <div style="overflow-x: auto; border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl);">
                            ${table.outerHTML}
                        </div>
                    `;
                } catch (err) {
                    ticketsBody.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ أثناء جلب التذاكر: ${err.message}</p>`;
                }
            },

            loadUserOrders: async function (phone, extraParams = '') {
                const bodyContainer = document.getElementById('user-modal-body');
                if (!bodyContainer) return;
                bodyContainer.innerHTML = '⏳ جاري جلب الطلبات...';

                try {
                    let allRowsHTML = [];
                    let currentPage = 1;
                    let hasMorePages = true;
                    let totalResultsFound = 0;

                    while (hasMorePages && currentPage <= 10) {
                        const searchUrl = `https://nippurconnect.com/admin/orders?q=${encodeURIComponent(phone)}&per_page=100&page=${currentPage}${extraParams}`;

                        const response = await fetch(searchUrl, {
                            headers: { 'X-Requested-With': 'XMLHttpRequest' },
                            credentials: 'include'
                        });

                        if (!response.ok) break;
                        const htmlText = await response.text();
                        const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                        if (currentPage === 1) {
                            doc.querySelectorAll('p').forEach(p => {
                                if (p.textContent.includes('of') && p.textContent.includes('results')) {
                                    const match = p.textContent.match(/of\s+(\d+)\s+results/i);
                                    if (match) totalResultsFound = parseInt(match[1], 10);
                                }
                            });
                        }

                        const rows = doc.querySelectorAll('table.table-modern tbody tr');
                        if (rows.length > 0) {
                            rows.forEach(r => allRowsHTML.push(r.innerHTML));
                            if (allRowsHTML.length >= totalResultsFound || rows.length < 100) {
                                hasMorePages = false;
                            } else {
                                currentPage++;
                            }
                        } else {
                            hasMorePages = false;
                        }
                    }

                    if (allRowsHTML.length === 0) {
                        bodyContainer.innerHTML = '<p style="color: var(--color-red-600); font-weight: 600; padding: 20px;">لا توجد طلبات مسجلة لهذا المستخدم تطابق خيارات البحث.</p>';
                        return;
                    }

                    let tableHTML = `
                        <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-gray-700); margin-bottom: 10px; text-align: right; display: flex; justify-content: space-between; align-items: center;">
                            <span>النتائج المعروضة: <span style="color: var(--color-brand-600); font-size: 0.85rem;">${allRowsHTML.length}</span> طلب</span>
                            <span style="font-size: 0.7rem; color: var(--color-emerald-700); background: var(--color-emerald-50); padding: 3px 8px; border-radius: var(--radius-md);">✓ تم السحب بنجاح</span>
                        </div>
                        <div style="overflow-x: auto; max-height: 48vh; border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl);">
                            <table class="table-modern" style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.75rem;">
                                <thead style="position: sticky; top: 0; background: var(--color-gray-100); z-index: 10;">
                                    <tr style="color: var(--color-gray-700); border-bottom: 2px solid var(--color-gray-200);">
                                        <th style="padding: 8px;">الرقم</th>
                                        <th style="padding: 8px;">المتجر</th>
                                        <th style="padding: 8px;">السائق</th>
                                        <th style="padding: 8px;">النوع</th>
                                        <th style="padding: 8px;">الإجمالي</th>
                                        <th style="padding: 8px;">الدفع</th>
                                        <th style="padding: 8px;">الحالة</th>
                                        <th style="padding: 8px;">الوقت</th>
                                        <th style="padding: 8px;">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    allRowsHTML.forEach(rowInnerHtml => {
                        const tempTr = document.createElement('tr');
                        tempTr.innerHTML = rowInnerHtml;
                        const tds = tempTr.querySelectorAll('td');

                        if (tds.length >= 9) {
                            tableHTML += `
                                <tr style="border-bottom: 1px solid var(--color-gray-100); background: #fff;">
                                    <td style="padding: 8px; font-weight: 700; color: var(--color-ink-900);">${tds[0].innerHTML}</td>
                                    <td style="padding: 8px; color: var(--color-gray-700);">${tds[2].innerHTML}</td>
                                    <td style="padding: 8px; color: var(--color-gray-700);">${tds[3].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[4].innerHTML}</td>
                                    <td style="padding: 8px; font-weight: 700;">${tds[5].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[6].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[7].innerHTML}</td>
                                    <td style="padding: 8px; color: var(--color-gray-500); white-space: nowrap;">${tds[8].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[9] ? tds[9].innerHTML : ''}</td>
                                </tr>
                            `;
                        }
                    });

                    tableHTML += `</tbody></table></div>`;
                    bodyContainer.innerHTML = tableHTML;
                } catch (err) {
                    bodyContainer.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ: ${err.message}</p>`;
                }
            }
        },
        // --- [كتلة: زر ونفذة سجل الزبون الشامل في صفحة تفاصيل الطلب الفردي - مع فلترة التواريخ] ---
        {
            id: 'singleOrderCustomerModal',
            name: 'سجل الزبون في صفحة الطلب',
            enabled: true,
            matchUrl: /\/admin\/orders\/\d+/,
            run: function () {
                // البحث عن صندوق معلومات الزبون في صفحة الطلب
                const customerCard = document.querySelector('div.card.p-4');
                if (!customerCard) return;

                const actionsContainer = customerCard.querySelector('#customer-actions-container');
                if (!actionsContainer || customerCard.querySelector('.nippur-single-customer-btn')) return;

                // استخراج رقم الهاتف من عنصر الـ ltr داخل الصندوق
                const phoneDiv = customerCard.querySelector('div.text-xs.text-gray-400.ltr');
                if (!phoneDiv) return;

                const customerPhone = phoneDiv.innerText.trim();
                if (!customerPhone) return;

                // استخراج اسم الزبون
                const nameNode = customerCard.querySelector('div.text-sm.text-gray-600');
                let customerName = "مشترك";
                if (nameNode) {
                    customerName = nameNode.childNodes[0].nodeValue ? nameNode.childNodes[0].nodeValue.trim() : "مشترك";
                }

                // إنشاء زر فتح نافذة السجل الشامل
                const logBtn = document.createElement('button');
                logBtn.type = 'button';
                logBtn.className = 'nippur-single-customer-btn';
                logBtn.style.cssText = `
                    display: inline-flex; align-items: center; gap: 6px;
                    background-color: var(--color-brand-600, #4f46e5); color: #fff !important;
                    padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold;
                    border: none; box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px; cursor: pointer;
                `;
                logBtn.innerHTML = `
                    <svg style="width:14px;height:14px; fill:currentColor;" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    <span>سجل الزبون الشامل</span>
                `;

                logBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await this.openCustomerModal(customerPhone, customerName);
                });

                actionsContainer.appendChild(logBtn);
            },

            openCustomerModal: async function (phone, customerName) {
                let modal = document.getElementById('nippur-customer-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'nippur-customer-modal';
                    modal.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(20, 20, 25, 0.65); backdrop-filter: blur(4px); z-index: 999999; display: flex;
                        align-items: center; justify-content: center; font-family: var(--default-font-family);
                        direction: rtl; padding: 20px;
                    `;
                    document.body.appendChild(modal);
                }

                const firstLetter = customerName ? customerName.charAt(0) : "م";

                modal.innerHTML = `
                    <div id="cust-modal-content-box" class="dash" style="background: var(--color-white); width: 100%; max-width: 1250px; border-radius: var(--radius-2xl); box-shadow: var(--shadow-card); height: 90vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-gray-200);">

                        <!-- شريط العناوين العلوي -->
                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-gray-50); border-bottom: 1px solid var(--color-gray-200); padding: 12px 20px;">
                            <h3 style="font-weight: 700; font-size: 1rem; color: var(--color-ink-900); margin: 0;">📦 لوحة إدارة وسجل طلبات الزبون</h3>
                            <button id="close-cust-modal" class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: var(--radius-md);">✕ إغلاق</button>
                        </div>

                        <!-- هيكل التقسيم -->
                        <div style="display: flex; flex: 1; overflow: hidden;">

                            <!-- القسم الأيمن: بطاقة الزبون ورقمه الثابت والتابات -->
                            <div style="width: 280px; background: var(--color-gray-50); border-left: 1px solid var(--color-gray-200); padding: 20px 14px; display: flex; flex-direction: column; overflow-y: auto;">
                                <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 16px;">
                                    <div style="width: 72px; height: 72px; border-radius: 9999px; background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700)); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; box-shadow: var(--shadow-brand); margin-bottom: 10px;">
                                        ${firstLetter}
                                    </div>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-ink-900); margin-bottom: 4px;">${customerName}</div>
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-brand-600); direction: ltr; margin-bottom: 6px;">${phone}</div>
                                    <span style="background: var(--color-emerald-100); color: var(--color-emerald-800); font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">CUSTOMER</span>
                                </div>

                                <div style="border-top: 1px solid var(--color-gray-200); margin-bottom: 16px;"></div>

                                <!-- التابات الجانبية -->
                                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                                    <button class="modal-tab-btn" data-tab="orders" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-brand-300); color: var(--color-brand-700); border-radius: var(--radius-lg); font-weight: 700; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>سجل الطلبات والفلترة</span>
                                        <span>‹</span>
                                    </button>
                                    <button class="modal-tab-btn" data-tab="info" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-gray-200); color: var(--color-gray-700); border-radius: var(--radius-lg); font-weight: 600; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>معلومات الزبون</span>
                                        <span>‹</span>
                                    </button>
                                    <button class="modal-tab-btn" data-tab="tickets" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px; background: var(--color-white); border: 1px solid var(--color-gray-200); color: var(--color-gray-700); border-radius: var(--radius-lg); font-weight: 600; font-size: 0.85rem; cursor: pointer; text-align: right;">
                                        <span>تذاكر الدعم الفني</span>
                                        <span>‹</span>
                                    </button>
                                </div>
                            </div>

                            <!-- القسم الأيسر: محتوى التابات -->
                            <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; overflow: hidden; background: #fff;">

                                <!-- التاب الأول: الطلبات -->
                                <div id="tab-content-orders" class="tab-pane" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                                    <div style="background: var(--color-gray-50); border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl); padding: 12px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; align-items: flex-end;">
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">فترة جاهزة</label>
                                            <select id="filter-quick-date" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">فترة مخصصة</option>
                                                <option value="today">طلبات اليوم</option>
                                                <option value="yesterday">طلبات البارحة</option>
                                                <option value="7days">آخر 7 أيام</option>
                                                <option value="30days">آخر 30 يوماً</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">من تاريخ</label>
                                            <input type="date" id="filter-from-date" style="font-size: 0.8rem; padding: 0.35rem; width: 100%; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md);">
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">إلى تاريخ</label>
                                            <input type="date" id="filter-to-date" style="font-size: 0.8rem; padding: 0.35rem; width: 100%; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md);">
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">الحالة</label>
                                            <select id="filter-status" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل الحالات</option>
                                                <option value="pending">قيد الانتظار</option><option value="accepted">مقبول</option><option value="rejected">مرفوض</option><option value="preparing">قيد التحضير</option><option value="ready">جاهز</option><option value="assigned">تم تعيين سائق</option><option value="picked_up">تم الاستلام</option><option value="on_the_way">في الطريق</option><option value="delivered">تم التوصيل</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">النوع</label>
                                            <select id="filter-type" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل الأنواع</option>
                                                <option value="delivery">توصيل</option><option value="pickup">استلام من المتجر</option><option value="dine_in">صالة (طاولة)</option><option value="takeaway">سفري</option><option value="peer_delivery">طلبي (توصيل بين الأشخاص)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">المحافظة</label>
                                            <select id="filter-governorate" style="font-size: 0.8rem; padding: 0.4rem;">
                                                <option value="">كل المحافظات</option>
                                                <option value="بغداد">بغداد</option><option value="البصرة">البصرة</option><option value="نينوى">نينوى</option><option value="أربيل">أربيل</option><option value="النجف">النجف</option><option value="كربلاء">كربلاء</option><option value="كركوك">كركوك</option><option value="الأنبار">الأنبار</option><option value="ديالى">ديالى</option><option value="ذي قار">ذي قار</option><option value="بابل">بابل</option><option value="واسط">واسط</option><option value="صلاح الدين">صلاح الدين</option><option value="القادسية">القادسية</option><option value="ميسان">ميسان</option><option value="المثنى">المثنى</option><option value="دهوك">دهوك</option><option value="السليمانية">السليمانية</option><option value="حلبجة">حلبجة</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">المتجر</label>
                                            <select id="filter-store" style="font-size: 0.8rem; padding: 0.4rem;"><option value="">كل المتاجر</option></select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.7rem; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 3px;">السائق</label>
                                            <select id="filter-driver" style="font-size: 0.8rem; padding: 0.4rem;"><option value="">كل السائقين</option></select>
                                        </div>
                                        <div>
                                            <button id="apply-filter-btn" type="button" class="btn btn-primary" style="width: 100%; padding: 0.45rem; font-size: 0.75rem;">تطبيق الفلتر</button>
                                        </div>
                                    </div>

                                    <div id="cust-modal-body" style="overflow-y: auto; flex: 1; text-align: center; padding: 10px; color: var(--color-gray-600);">
                                        ⏳ جاري جلب كافة طلبات الزبون...
                                    </div>
                                </div>

                                <!-- التاب الثاني: معلومات الزبون -->
                                <div id="tab-content-info" class="tab-pane" style="display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 10px;">
                                    <div id="customer-info-body" style="text-align: center; color: var(--color-gray-600); padding: 40px;">
                                        ⏳ جاري جلب بيانات وحساب الزبون...
                                    </div>
                                </div>

                                <!-- التاب الثالث: التذاكر -->
                                <div id="tab-content-tickets" class="tab-pane" style="display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 10px;">
                                    <div id="customer-tickets-body" style="text-align: center; color: var(--color-gray-600); padding: 40px;">
                                        ⏳ جاري جلب تذاكر الدعم الفني للمشترك...
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                `;

                document.getElementById('close-cust-modal').addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

                // تفعيل اختيار الفترات الجاهزة وتعبئة التواريخ تلقائياً
                const quickDateSelect = document.getElementById('filter-quick-date');
                quickDateSelect.addEventListener('change', () => {
                    const val = quickDateSelect.value;
                    const today = new Date();
                    const formatDate = (d) => d.toISOString().split('T')[0];

                    let fromStr = '';
                    let toStr = formatDate(today);

                    if (val === 'today') {
                        fromStr = toStr;
                    } else if (val === 'yesterday') {
                        const yest = new Date();
                        yest.setDate(today.getDate() - 1);
                        fromStr = formatDate(yest);
                        toStr = fromStr;
                    } else if (val === '7days') {
                        const past = new Date();
                        past.setDate(today.getDate() - 7);
                        fromStr = formatDate(past);
                    } else if (val === '30days') {
                        const past = new Date();
                        past.setDate(today.getDate() - 30);
                        fromStr = formatDate(past);
                    } else {
                        fromStr = '';
                        toStr = '';
                    }

                    document.getElementById('filter-from-date').value = fromStr;
                    document.getElementById('filter-to-date').value = toStr;
                });

                // تبديل التابات
                const tabBtns = modal.querySelectorAll('.modal-tab-btn');
                tabBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        tabBtns.forEach(b => {
                            b.style.background = 'var(--color-white)';
                            b.style.color = 'var(--color-gray-700)';
                            b.style.borderColor = 'var(--color-gray-200)';
                            b.style.fontWeight = '600';
                        });
                        btn.style.background = 'var(--color-white)';
                        btn.style.color = 'var(--color-brand-700)';
                        btn.style.borderColor = 'var(--color-brand-300)';
                        btn.style.fontWeight = '700';

                        const targetTab = btn.getAttribute('data-tab');
                        modal.querySelectorAll('.tab-pane').forEach(pane => pane.style.display = 'none');
                        const targetPane = document.getElementById(`tab-content-${targetTab}`);
                        if (targetPane) targetPane.style.display = 'flex';
                    });
                });

                this.loadCustomerDetails(phone);
                this.loadCustomerTickets(phone);
                await this.loadAndRenderOrders(phone, '');

                // تفعيل زر تطبيق الفلتر مع معاملات التواريخ
                const applyBtn = document.getElementById('apply-filter-btn');
                const newApplyBtn = applyBtn.cloneNode(true);
                applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);

                newApplyBtn.addEventListener('click', async () => {
                    const status = document.getElementById('filter-status').value;
                    const type = document.getElementById('filter-type').value;
                    const governorate = document.getElementById('filter-governorate').value;
                    const store_id = document.getElementById('filter-store').value;
                    const driver_user_id = document.getElementById('filter-driver').value;
                    const fromDate = document.getElementById('filter-from-date').value;
                    const toDate = document.getElementById('filter-to-date').value;

                    const params = `&status=${status}&type=${type}&governorate=${encodeURIComponent(governorate)}&store_id=${store_id}&driver_user_id=${driver_user_id}&from=${fromDate}&to=${toDate}`;
                    await this.loadAndRenderOrders(phone, params);
                });
            },

            loadCustomerDetails: async function (phone) {
                const infoBody = document.getElementById('customer-info-body');
                try {
                    const searchRes = await fetch(`https://nippurconnect.com/admin/users?q=${encodeURIComponent(phone)}&role=&governorate=`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (!searchRes.ok) throw new Error('فشل جلب بيانات المستخدم');
                    const htmlText = await searchRes.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                    const editLink = doc.querySelector('a[href*="/admin/users/"][href*="/edit"]');
                    if (!editLink) {
                        infoBody.innerHTML = '<p style="color: var(--color-red-600); font-weight: 600;">لم يتم العثور على ملف تعريف لهذا المستخدم في نظام المستخدمين.</p>';
                        return;
                    }

                    const editUrl = editLink.href;
                    const userRow = editLink.closest('tr');
                    let statusBadgeHTML = '—';
                    let rolesHTML = '—';
                    if (userRow) {
                        const tds = userRow.querySelectorAll('td');
                        if (tds.length >= 5) {
                            rolesHTML = tds[3].innerHTML;
                            statusBadgeHTML = tds[4].innerHTML;
                        }
                    }

                    const editRes = await fetch(editUrl);
                    if (!editRes.ok) throw new Error('فشل جلب تفاصيل العنوان');
                    const editHtmlText = await editRes.text();
                    const editDoc = new DOMParser().parseFromString(editHtmlText, 'text/html');

                    const fullAddress = editDoc.querySelector('input[name="address[full_address]"]')?.value || '—';
                    const city = editDoc.querySelector('input[name="address[city]"]')?.value || '—';
                    const area = editDoc.querySelector('input[name="address[area]"]')?.value || '—';
                    const building = editDoc.querySelector('input[name="address[building]"]')?.value || '—';
                    const floor = editDoc.querySelector('input[name="address[floor]"]')?.value || '—';
                    const addressPhone = editDoc.querySelector('input[name="address[phone]"]')?.value || phone;
                    const notes = editDoc.querySelector('input[name="address[notes]"]')?.value || '—';

                    infoBody.innerHTML = `
                        <div style="text-align: right; display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 10px;">
                                <h4 style="font-weight: 700; font-size: 0.95rem; color: var(--color-ink-900); margin: 0;">معلومات الحساب والأدوار</h4>
                                <div>${statusBadgeHTML}</div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-xl); border: 1px solid var(--color-gray-200);">
                                <div>
                                    <span style="font-size: 0.75rem; color: var(--color-gray-500); display: block; margin-bottom: 2px;">الأدوار والصلاحيات:</span>
                                    <div>${rolesHTML}</div>
                                </div>
                                <div>
                                    <span style="font-size: 0.75rem; color: var(--color-gray-500); display: block; margin-bottom: 2px;">رقم الهاتف الرئيسي:</span>
                                    <span style="font-weight: 700; direction: ltr; display: inline-block;">${phone}</span>
                                </div>
                            </div>

                            <h4 style="font-weight: 700; font-size: 0.95rem; color: var(--color-ink-900); margin-top: 10px; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 10px;">تفاصيل العنوان</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">العنوان التفصيلي</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${fullAddress}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المدينة</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${city}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المنطقة / الحي</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${area}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">المبنى</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${building || '—'}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">الطابق</span>
                                    <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${floor || '—'}</span>
                                </div>
                                <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 10px 14px; border-radius: var(--radius-lg);">
                                    <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">هاتف العنوان</span>
                                    <span style="font-weight: 600; color: var(--color-brand-600); font-size: 0.85rem; direction: ltr; display: inline-block;">${addressPhone}</span>
                                </div>
                            </div>
                            <div style="background: var(--color-white); border: 1px solid var(--color-gray-200); padding: 12px 14px; border-radius: var(--radius-lg); margin-top: 4px;">
                                <span style="font-size: 0.7rem; color: var(--color-gray-400); display: block;">ملاحظات العنوان</span>
                                <span style="font-weight: 600; color: var(--color-gray-800); font-size: 0.85rem;">${notes || '—'}</span>
                            </div>
                        </div>
                    `;
                } catch (err) {
                    infoBody.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ أثناء جلب معلومات الزبون: ${err.message}</p>`;
                }
            },

            loadCustomerTickets: async function (phone) {
                const ticketsBody = document.getElementById('customer-tickets-body');
                try {
                    const res = await fetch(`https://nippurconnect.com/admin/support?q=${encodeURIComponent(phone)}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (!res.ok) throw new Error('فشل جلب التذاكر');
                    const htmlText = await res.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                    const table = doc.querySelector('table.table-modern');
                    if (!table) {
                        ticketsBody.innerHTML = '<p style="color: var(--color-gray-500); font-weight: 600; padding: 20px;">لا توجد تذاكر دعم فني مسجلة لهذا الزبون.</p>';
                        return;
                    }

                    ticketsBody.innerHTML = `<div style="overflow-x: auto; border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl);">${table.outerHTML}</div>`;
                } catch (err) {
                    ticketsBody.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">حدث خطأ أثناء جلب التذاكر: ${err.message}</p>`;
                }
            },

            loadAndRenderOrders: async function (phone, extraParams = '') {
                const bodyContainer = document.getElementById('cust-modal-body');
                if (!bodyContainer) return;
                bodyContainer.innerHTML = '⏳ جاري جلب الطلبات...';

                try {
                    let allRowsHTML = [];
                    let currentPage = 1;
                    let hasMorePages = true;
                    let totalResultsFound = 0;

                    while (hasMorePages && currentPage <= 10) {
                        const searchUrl = `https://nippurconnect.com/admin/orders?q=${encodeURIComponent(phone)}&per_page=100&page=${currentPage}${extraParams}`;
                        const response = await fetch(searchUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
                        if (!response.ok) break;
                        const htmlText = await response.text();
                        const doc = new DOMParser().parseFromString(htmlText, 'text/html');

                        if (currentPage === 1) {
                            doc.querySelectorAll('p').forEach(p => {
                                if (p.textContent.includes('of') && p.textContent.includes('results')) {
                                    const match = p.textContent.match(/of\s+(\d+)\s+results/i);
                                    if (match) totalResultsFound = parseInt(match[1], 10);
                                }
                            });
                        }

                        const rows = doc.querySelectorAll('table.table-modern tbody tr');
                        if (rows.length > 0) {
                            rows.forEach(r => allRowsHTML.push(r.innerHTML));
                            if (allRowsHTML.length >= totalResultsFound || rows.length < 100) {
                                hasMorePages = false;
                            } else {
                                currentPage++;
                            }
                        } else {
                            hasMorePages = false;
                        }
                    }

                    if (allRowsHTML.length === 0) {
                        bodyContainer.innerHTML = '<p style="color: var(--color-red-600); font-weight: 600; padding: 20px;">لا توجد طلبات تطابق الفلتر.</p>';
                        return;
                    }

                    let tableHTML = `
                        <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-gray-700); margin-bottom: 10px; text-align: right;">النتائج: ${allRowsHTML.length} طلب</div>
                        <div style="overflow-x: auto; max-height: 48vh; border: 1px solid var(--color-gray-200); border-radius: var(--radius-xl);">
                            <table class="table-modern" style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.75rem;">
                                <thead style="position: sticky; top: 0; background: var(--color-gray-100); z-index: 10;">
                                    <tr>
                                        <th style="padding: 8px;">الرقم</th><th style="padding: 8px;">المتجر</th><th style="padding: 8px;">السائق</th><th style="padding: 8px;">النوع</th><th style="padding: 8px;">الإجمالي</th><th style="padding: 8px;">الدفع</th><th style="padding: 8px;">الحالة</th><th style="padding: 8px;">الوقت</th><th style="padding: 8px;">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    allRowsHTML.forEach(rowInnerHtml => {
                        const tempTr = document.createElement('tr');
                        tempTr.innerHTML = rowInnerHtml;
                        const tds = tempTr.querySelectorAll('td');
                        if (tds.length >= 9) {
                            tableHTML += `
                                <tr style="border-bottom: 1px solid var(--color-gray-100); background: #fff;">
                                    <td style="padding: 8px; font-weight: 700;">${tds[0].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[2].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[3].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[4].innerHTML}</td>
                                    <td style="padding: 8px; font-weight: 700;">${tds[5].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[6].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[7].innerHTML}</td>
                                    <td style="padding: 8px; color: var(--color-gray-500);">${tds[8].innerHTML}</td>
                                    <td style="padding: 8px;">${tds[9] ? tds[9].innerHTML : ''}</td>
                                </tr>
                            `;
                        }
                    });

                    tableHTML += `</tbody></table></div>`;
                    bodyContainer.innerHTML = tableHTML;
                } catch (err) {
                    bodyContainer.innerHTML = `<p style="color: var(--color-red-600); font-weight: 600;">خطأ في جلب السجل: ${err.message}</p>`;
                }
            }
        }

    ];

    // =========================================================================
    // 3. محرك إدارة التخزين والإعدادات الديناميكية (Dynamic Options Engine)
    // =========================================================================
    function loadSavedSettings() {
        const saved = localStorage.getItem('nippur_master_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                SYSTEM_CORE.globalEnabled = parsed.globalEnabled ?? true;
                MODULES.forEach(mod => {
                    if (parsed.modules && parsed.modules[mod.id]) {
                        mod.enabled = parsed.modules[mod.id].enabled ?? mod.enabled;
                        if (parsed.modules[mod.id].options) {
                            for (let optKey in parsed.modules[mod.id].options) {
                                if (mod.options[optKey]) {
                                    mod.options[optKey].value = parsed.modules[mod.id].options[optKey];
                                }
                            }
                        }
                    }
                });
            } catch (e) {
                console.error("خطأ في قراءة إعدادات التخزين", e);
            }
        }
    }

    function saveSettings() {
        const saveData = {
            globalEnabled: SYSTEM_CORE.globalEnabled,
            modules: {}
        };
        MODULES.forEach(mod => {
            saveData.modules[mod.id] = {
                enabled: mod.enabled,
                options: {}
            };
            for (let optKey in mod.options) {
                saveData.modules[mod.id].options[optKey] = mod.options[optKey].value;
            }
        });
        localStorage.setItem('nippur_master_config', JSON.stringify(saveData));
        showSaveIndicator();
    }

    function showSaveIndicator() {
        let indicator = document.getElementById('nippur-save-indicator');
        if (indicator) {
            indicator.innerText = ' (تم الحفظ ✓)';
            setTimeout(() => { indicator.innerText = ''; }, 1500);
        }
    }

    // =========================================================================
    // 4. بناء واجهة التحكم ونظام توليد الخيارات المتطور (Tabs & Options Builder)
    // =========================================================================
    function buildDashboardUI() {
        if (document.getElementById('nippur-float-btn')) return;

        loadSavedSettings();

        const floatBtn = document.createElement('div');
        floatBtn.id = 'nippur-float-btn';
        floatBtn.style.cssText = `
            position: fixed; top: 15px; right: 15px; z-index: 999999;
            width: 42px; height: 42px; background: #111827; color: #fff;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25); cursor: pointer; font-size: 20px;
            transition: transform 0.2s ease, background 0.2s ease;
        `;
        floatBtn.title = 'إعدادات سكربتات Nippur';
        floatBtn.innerHTML = '⚙️';

        floatBtn.onmouseover = () => { floatBtn.style.transform = 'scale(1.08)'; floatBtn.style.backgroundColor = '#1f2937'; };
        floatBtn.onmouseout = () => { floatBtn.style.transform = 'scale(1)'; floatBtn.style.backgroundColor = '#111827'; };

        const modal = document.createElement('div');
        modal.id = 'nippur-settings-modal';
        modal.style.cssText = `
            position: fixed; top: 68px; right: 15px; z-index: 999999;
            background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2); font-family: system-ui, -apple-system, sans-serif;
            width: 330px; direction: rtl; font-size: 12px; color: #1f2937; display: none;
            overflow: hidden;
        `;

        let tabsHeaderHTML = '';
        let tabsContentHTML = '';
        let otherModulesHTML = '';

        MODULES.forEach((mod, index) => {
            let optionsHTML = '';

            // مولد خيارات ديناميكي متطور يدعم أنواع متعددة (Boolean, Text, Select, Number)
            for (let optKey in mod.options) {
                const opt = mod.options[optKey];

                if (opt.type === 'boolean') {
                    optionsHTML += `
                        <label style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11px; color:#4b5563; cursor:pointer;">
                            <span>${opt.label}</span>
                            <input type="checkbox" class="mod-opt-input" data-type="boolean" data-mod="${mod.id}" data-opt="${optKey}" ${opt.value ? 'checked' : ''}>
                        </label>
                    `;
                } else if (opt.type === 'text' || opt.type === 'number') {
                    optionsHTML += `
                        <div style="margin-top:8px; font-size:11px; color:#4b5563;">
                            <div style="margin-bottom:2px; font-weight:500;">${opt.label}:</div>
                            <input type="${opt.type}" class="mod-opt-input" data-type="${opt.type}" data-mod="${mod.id}" data-opt="${optKey}" value="${opt.value}" style="width:100%; border:1px solid #d1d5db; border-radius:4px; padding:4px 6px; font-size:11px;">
                        </div>
                    `;
                } else if (opt.type === 'select') {
                    let selectOptionsHTML = '';
                    if (opt.choices && Array.isArray(opt.choices)) {
                        opt.choices.forEach(choice => {
                            const isSelected = choice.value === opt.value ? 'selected' : '';
                            selectOptionsHTML += `<option value="${choice.value}" ${isSelected}>${choice.label}</option>`;
                        });
                    }
                    optionsHTML += `
                        <div style="margin-top:8px; font-size:11px; color:#4b5563;">
                            <div style="margin-bottom:2px; font-weight:500;">${opt.label}:</div>
                            <select class="mod-opt-input" data-type="select" data-mod="${mod.id}" data-opt="${optKey}" style="width:100%; border:1px solid #d1d5db; border-radius:4px; padding:4px 6px; font-size:11px; background:#fff;">
                                ${selectOptionsHTML}
                            </select>
                        </div>
                    `;
                }
            }

            const moduleCardHTML = `
                <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin-bottom:8px;">
                    <label style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; cursor:pointer; color:#111827;">
                        <span>${mod.name}</span>
                        <input type="checkbox" class="mod-enable-chk" data-mod="${mod.id}" ${mod.enabled ? 'checked' : ''}>
                    </label>
                    <div style="margin-top:6px; padding-top:6px; border-top:1px solid #e5e7eb;">
                        ${optionsHTML}
                    </div>
                </div>
            `;

            if (index < 3) {
                const tabId = `tab-${mod.id}`;
                tabsHeaderHTML += `<button class="nippur-tab-btn" data-target="${tabId}" style="flex:1; padding:8px 4px; background:#f3f4f6; border:none; border-bottom:2px solid transparent; cursor:pointer; font-weight:bold; font-size:11px; color:#4b5563;">${mod.name}</button>`;
                tabsContentHTML += `
                    <div id="${tabId}" class="nippur-tab-pane" style="display:none; padding:12px; max-height:280px; overflow-y:auto;">
                        ${moduleCardHTML}
                    </div>
                `;
            } else {
                otherModulesHTML += moduleCardHTML;
            }
        });

        if (MODULES.length > 3) {
            tabsHeaderHTML += `<button class="nippur-tab-btn" data-target="tab-others" style="flex:1; padding:8px 4px; background:#f3f4f6; border:none; border-bottom:2px solid transparent; cursor:pointer; font-weight:bold; font-size:11px; color:#4b5563;">أخرى</button>`;
            tabsContentHTML += `
                <div id="tab-others" class="nippur-tab-pane" style="display:none; padding:12px; max-height:280px; overflow-y:auto;">
                    ${otherModulesHTML}
                </div>
            `;
        }

        tabsHeaderHTML += `<button class="nippur-tab-btn" data-target="tab-advanced" style="flex:1; padding:8px 4px; background:#f3f4f6; border:none; border-bottom:2px solid transparent; cursor:pointer; font-weight:bold; font-size:11px; color:#4b5563;">متقدم</button>`;
        tabsContentHTML += `
            <div id="tab-advanced" class="nippur-tab-pane" style="display:none; padding:12px; max-height:280px; overflow-y:auto;">
                <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px;">
                    <div style="font-weight:bold; color:#111827; margin-bottom:8px;">إعدادات النظام المركزي</div>
                    <label style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; cursor:pointer; color:#374151;">
                        <span>تفعيل السكربت بالكامل:</span>
                        <input type="checkbox" id="core-master-switch" ${SYSTEM_CORE.globalEnabled ? 'checked' : ''}>
                    </label>
                    <div style="font-size:10px; color:#6b7280; margin-top:6px;">تعطيل هذا الخيار يوقف عمل كافة الكتل فوراً.</div>
                </div>
            </div>
        `;

        tabsHeaderHTML += `<button class="nippur-tab-btn" data-target="tab-about" style="flex:1; padding:8px 4px; background:#f3f4f6; border:none; border-bottom:2px solid transparent; cursor:pointer; font-weight:bold; font-size:11px; color:#4b5563;">حول</button>`;
        tabsContentHTML += `
            <div id="tab-about" class="nippur-tab-pane" style="display:none; padding:16px; text-align:center; color:#4b5563;">
                <div style="font-weight:bold; font-size:13px; color:#111827; margin-bottom:4px;">NippurConnect Master Hub</div>
                <div style="font-size:11px; margin-bottom:8px;">الإصدار: ${SYSTEM_CORE.version}</div>
                <div style="font-size:10px; color:#9ca3af;">نظام موحد لإدارة الكتل الفرعية والتحكم الآلي.</div>
            </div>
        `;

        modal.innerHTML = `
            <div style="background:#111827; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; font-size:13px;">⚙️ إعدادات السكربتات <span id="nippur-save-indicator" style="font-size:10px; color:#10B981; font-weight:normal;"></span></span>
                <span id="nippur-close-modal" style="cursor:pointer; font-size:14px; background:#374151; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center;">✕</span>
            </div>
            <div style="display:flex; border-bottom:1px solid #e5e7eb; background:#f3f4f6;">
                ${tabsHeaderHTML}
            </div>
            <div id="nippur-tabs-container">
                ${tabsContentHTML}
            </div>
        `;

        document.body.appendChild(floatBtn);
        document.body.appendChild(modal);

        floatBtn.addEventListener('click', () => {
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
        });

        document.getElementById('nippur-close-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        const tabButtons = modal.querySelectorAll('.nippur-tab-btn');
        const tabPanes = modal.querySelectorAll('.nippur-tab-pane');

        function switchTab(targetId) {
            tabButtons.forEach(btn => {
                if (btn.getAttribute('data-target') === targetId) {
                    btn.style.backgroundColor = '#ffffff';
                    btn.style.borderBottomColor = '#2563eb';
                    btn.style.color = '#2563eb';
                } else {
                    btn.style.backgroundColor = '#f3f4f6';
                    btn.style.borderBottomColor = 'transparent';
                    btn.style.color = '#4b5563';
                }
            });
            tabPanes.forEach(pane => {
                pane.style.display = pane.id === targetId ? 'block' : 'none';
            });
        }

        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchTab(e.target.getAttribute('data-target'));
            });
        });

        if (tabButtons.length > 0) {
            switchTab(tabButtons[0].getAttribute('data-target'));
        }

        document.getElementById('core-master-switch').addEventListener('change', (e) => {
            SYSTEM_CORE.globalEnabled = e.target.checked;
            saveSettings();
            setTimeout(() => location.reload(), 500);
        });

        modal.querySelectorAll('.mod-enable-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const modId = e.target.getAttribute('data-mod');
                const mod = MODULES.find(m => m.id === modId);
                if (mod) {
                    mod.enabled = e.target.checked;
                    saveSettings();
                }
            });
        });

        // ربط أحداث الحفظ التلقائي لكافة الأنواع (Boolean, Text, Number, Select)
        modal.querySelectorAll('.mod-opt-input').forEach(input => {
            const eventType = input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input';

            input.addEventListener(eventType, (e) => {
                const modId = e.target.getAttribute('data-mod');
                const optKey = e.target.getAttribute('data-opt');
                const optType = e.target.getAttribute('data-type');
                const mod = MODULES.find(m => m.id === modId);

                if (mod && mod.options[optKey]) {
                    if (optType === 'boolean') {
                        mod.options[optKey].value = e.target.checked;
                    } else {
                        mod.options[optKey].value = e.target.value;
                    }
                    saveSettings();
                }
            });
        });
    }

    // =========================================================================
    // 5. المحرك المركزي لتشغيل الكتل
    // =========================================================================
    function runCoreEngine() {
        if (!SYSTEM_CORE.globalEnabled) return;

        buildDashboardUI();
        const currentUrl = window.location.href;

        MODULES.forEach(mod => {
            if (mod.enabled) {
                const isMatched = mod.matchUrl ? mod.matchUrl.test(currentUrl) : true;
                if (isMatched) {
                    try {
                        mod.run(mod.options);
                    } catch (err) {
                        SYSTEM_CORE.log(mod.name, err);
                    }
                }
            }
        });
    }

    loadSavedSettings();
    runCoreEngine();

    const observer = new MutationObserver(() => {
        runCoreEngine();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
