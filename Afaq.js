// ==UserScript==
// @name         FTTH Smart Monitor V5.1
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  نظام إدارة FTTH - قفل أزرار التمديد والتجديد وإظهار كامل التفاصيل
// @author       Muntadher Imad
// @match        *://admin.ftth.iq/*
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// @connect      googleusercontent.com
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBWhAKKJe7oRdO2lCop7pgnDSm_Wxeospa8kl4sI4O-x2rU0ESVS1VnDY5rWDfRQ/pub?output=csv";

    let lastSubCode = "";
    let isFetching = false;

    function checkPage() {
        if (!window.location.href.includes('/details/view')) {
            removeUI();
            lastSubCode = "";
            return;
        }

        const subElement = document.querySelector('[data-test-id="sub-list-item-device-username-0"]');
        if (subElement) {
            const currentCode = subElement.innerText.trim();

            if ((currentCode !== lastSubCode || !document.getElementById("ftth-alert-banner")) && !isFetching) {
                if (currentCode !== lastSubCode) {
                    removeUI();
                    lastSubCode = currentCode;
                }
                fetchData(currentCode);
            }
        }
    }

    function fetchData(currentCode) {
        isFetching = true;
        GM_xmlhttpRequest({
            method: "GET",
            url: sheetUrl,
            anonymous: true,
            onload: function(response) {
                const rows = response.responseText.split('\n').map(row =>
                    row.split(',').map(cell => cell.replace(/"/g, '').trim())
                );

                let offer = rows.find(r => r[1] === currentCode);
                let beneficiary = rows.find(r => r[10] === currentCode);

                removeUI();

                if (offer && offer[8] === "قيد الاستخدام") {
                    const msg = `⚠️ عرض نشط | المالك الأصلي: ${offer[0]} | المستفيد الحالي: ${offer[4]} | السعر: ${offer[3]} | ينتهي: ${offer[7]} (${offer[9]} يوم متبقي)`;
                    showUI(msg, "#d63031");
                }
                else if (beneficiary && beneficiary[8] === "قيد الاستخدام") {
                    const msg = `ℹ️ مشترك مستفيد | الاسم: ${beneficiary[4]} | يستخدم عرض الرمز: ${beneficiary[1]} (المالك: ${beneficiary[0]}) | ينتهي: ${beneficiary[7]}`;
                    showUI(msg, "#6c5ce7");
                }
                isFetching = false;
            },
            onerror: function() { isFetching = false; }
        });
    }

    setInterval(checkPage, 1000);

    function showUI(msg, color) {
        if (document.getElementById("ftth-alert-banner")) return;

        const banner = document.createElement("div");
        banner.id = "ftth-alert-banner";
        banner.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; z-index: 999999; background-color: " + color + "; color: white; text-align: center; padding: 12px 5px; font-weight: bold; font-size: 15px; direction: rtl; border-bottom: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-family: Arial, sans-serif;";

        banner.innerText = msg;
        document.body.prepend(banner);
        document.body.style.paddingTop = "50px";

        const actionButtons = [
            '[data-test-id="sub-list-item-btn-extend-0"]',
            '[data-test-id="sub-list-item-btn-renew-0"]'
        ];

        actionButtons.forEach(selector => {
            const btn = document.querySelector(selector);
            if (btn) {
                btn.style.filter = "grayscale(1) opacity(0.2)";
                btn.style.pointerEvents = "none";
                btn.parentElement.style.cursor = "not-allowed";
                btn.title = "تم القفل بواسطة نظام إدارة العروض";
            }
        });
    }

    function removeUI() {
        const banner = document.getElementById("ftth-alert-banner");
        if (banner) {
            banner.remove();
            document.body.style.paddingTop = "0px";
        }
    }
})();
