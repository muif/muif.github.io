function generateText() {
    const deviceName = document.getElementById('device-name').value;
    const screen = document.getElementById('screen').value;
    const processor = document.getElementById('processor').value;
    const cameras = document.getElementById('cameras').value;
    const memory = document.getElementById('memory').value;
    const battery = document.getElementById('battery').value;

    const result = `
${deviceName}
متوفر الان 🔥
وتكدر تاخذه بالتقسيط المريح مع ضمان مركز ستارلنك لمدة سنة 📄

🔹المواصفات

📱 الشاشة : ${screen} 
⚙️ المعالج : ${processor} 
📷 الكاميرات : ${cameras} 
💾 الذاكرة : ${memory}
🔋 البطارية : ${battery} 

📞 تواصل معنا (هاتف + واتساب) : 07845554551
📌 العنوان : الديوانية - قضاء عفك - قرب الكراج
🌐 تابعنا على مواقع التواصل الاجتماعي : https://linktr.ee/starlinkiq
    `;
    document.getElementById('result').value = result;
}

function copyText() {
    const result = document.getElementById('result');
    result.select();
    document.execCommand('copy');
    alert('تم نسخ النص!');
}

function share(platform) {
    const text = document.getElementById('result').value;
    let url = '';
    if (platform === 'facebook') {
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(text)}`;
    } else if (platform === 'instagram') {
        alert('Instagram لا يدعم المشاركة مباشرة، انسخ النص وضعه يدوياً.');
        return;
    } else if (platform === 'telegram') {
        url = `https://t.me/share/url?url=${encodeURIComponent(text)}`;
    }
    if (url) {
        window.open(url, '_blank');
    }
}