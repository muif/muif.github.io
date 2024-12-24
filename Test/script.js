const form = document.getElementById('myForm');
form.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = document.getElementById('name').value;
    const birthdate = document.getElementById('birthdate').value;
    const image = document.getElementById('image').files[0];

    // تحويل الصورة إلى قاعدة 64
    const reader = new FileReader();
    reader.readAsDataURL(image);
    reader.onload = function() {
        const base64String = reader.result;

        // إرسال البيانات إلى Google Sheets باستخدام Google Apps Script
        const scriptUrl = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
        fetch(scriptUrl, {
            method: 'post',
            contentType: 'application/x-www-form-urlencoded',
            body: `name=${encodeURIComponent(name)}&birthdate=${encodeURIComponent(birthdate)}&image=${encodeURIComponent(base64String)}`
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            // عرض رسالة نجاح أو فشل
        })
        .catch(error => {
            console.error('Error:', error);
        });
    };
});
