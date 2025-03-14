(async () => {
  try {
    const customerListCols = document.querySelectorAll('.customers-list-col');
    if (customerListCols.length > 0) {
      let csvContent = 'data:text/csv;charset=utf-8,\uFEFFمعرف المشترك,اسم المشترك,رقم الهاتف,اسم اليوزر,السيريال,تاريخ الانشاء\r\n';

      customerListCols.forEach(col => {
        // استخراج البيانات
        const username = col.querySelector('[data-test-id="customers-list-cst-deviceDetails-1"]')?.textContent.trim() ?? '';
        const serial = col.querySelector('.value.ng-star-inserted:not([data-test-id])')?.textContent.trim() ?? '';
        const createdAt = col.querySelector('[data-test-id="customers-list-cst-created-at-2"]')?.textContent.trim() ?? '';

        // ترتيب البيانات في الصف
        const row = [
          '', // معرف المشترك (فارغ في هذا المثال)
          '', // اسم المشترك (فارغ في هذا المثال)
          '', // رقم الهاتف (فارغ في هذا المثال)
          username,
          serial,
          createdAt
        ];

        // تحويل الصف إلى سلسلة CSV
        csvContent += row.join(',') + '\r\n';
      });

      // إنشاء رابط التنزيل
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'scrapedData.csv');
      document.body.appendChild(link);
      link.click();
    } else {
      console.error('لم يتم العثور على البيانات المطلوبة.');
    }
  } catch (error) {
    console.error('حدث خطأ:', error);
  }
})();
