const scriptURL = 'https://script.google.com/macros/s/AKfycbwAfRBFd4SgNRyt7Y91hGSlMlcY7sU3qfeSO8m9IXEAQNuf8WYTC1uq1lC0Z5iWa58c/exec'

const form = document.forms['contact-form']

form.addEventListener('submit', e => {
  e.preventDefault()
  fetch(scriptURL, { method: 'POST', body: new FormData(form)})
  .then(response => alert("تم إرسال بياناتك بنجاح!" ))
  .then(() => { window.location.reload(); })
  .catch(error => console.error('خطأ!!', error.message))
})