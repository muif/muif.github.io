document.getElementById("area").addEventListener("change", function () {
    const area = document.getElementById("area").value;
    const areaDetails = document.getElementById("areaDetails");

    // نصوص المناطق بناءً على الرقم
    const areaTexts = {
        "143": "السوق + ال عبود",
        "144": "حي اور",
        "145": "القاطع",
        "146": "حي عاصي",
        "147": "المنطقة المحيطة بالمستشفى",
        "148": "حي الحسين",
        "149": "لعيبي",
        "150": "الجوادين + الدلال",
        "151": "الوائلي + حي الضباط",
        "152": "العسكري",
        "153": "القاطع + حي الشرطة",
        "154": "حي الشرطة + حي اور",
    };

    // تحديث النصوص بناءً على المنطقة المختارة
    areaDetails.value = areaTexts[area] || "";
});

document.getElementById("generateButton").addEventListener("click", function () {
    const company = document.getElementById("company").value;
    const area = document.getElementById("area").value;
    const vat = document.getElementById("vat").value;
    const port = document.getElementById("port").value;
    const agentCode = document.getElementById("agentCode").value;
    const caseOption = document.getElementById("caseOption").value;

    if (!vat || !agentCode) {
        alert("يرجى إدخال جميع الحقول المطلوبة!");
        return;
    }

    let serialNumber = `${company}${area}F${vat}P${port}${agentCode}`;

    // تعديل الحروف بناءً على الاختيار
    if (caseOption === "uppercase") {
        serialNumber = serialNumber.toUpperCase();
    } else if (caseOption === "lowercase") {
        serialNumber = serialNumber.toLowerCase();
    }

    document.getElementById("serialNumber").value = serialNumber;
});

document.getElementById("copyButton").addEventListener("click", function () {
    const serialNumber = document.getElementById("serialNumber");
    serialNumber.select();
    serialNumber.setSelectionRange(0, 99999); // لأجهزة الموبايل
    navigator.clipboard.writeText(serialNumber.value)
        .then(() => alert("تم نسخ النص!"))
        .catch(() => alert("فشل نسخ النص!"));
});
