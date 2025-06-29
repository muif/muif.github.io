// *** STEP 1: REPLACE THIS URL WITH YOUR DEPLOYMENT URL FROM APPS SCRIPT ***
const API_URL = 'https://script.google.com/macros/s/AKfycbzG7VF1E-17nN9jYqlpfQxpq0bzeRCOd7OLC3GR_RqCl4s4iitCuqD0IK-8eakbUQ-C/exec'; 

document.addEventListener('DOMContentLoaded', function() {
  const addSubscriberForm = document.getElementById('add-subscriber-form');
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const subscriberDetails = document.getElementById('subscriber-details');
  const activationInfo = document.getElementById('activation-info');
  const activateButton = document.getElementById('activate-button');
  const payButton = document.getElementById('pay-button');
  
  const activationModal = document.getElementById('activation-modal');
  const paymentModal = document.getElementById('payment-modal');
  const activationForm = document.getElementById('activation-form');
  const paymentForm = document.getElementById('payment-form');
  const packagesSelect = document.getElementById('packages-select');
  const priceInput = document.getElementById('price-input');
  const activationDateInput = document.getElementById('activation-date-input');
  const expirationDateInput = document.getElementById('expiration-date-input');
  const closeActivationModal = document.getElementById('close-activation-modal');
  const closePaymentModal = document.getElementById('close-payment-modal');
  
  let currentSubscriber = null;

  // Helper function to send data to the Apps Script API using fetch
  async function sendToAPI(action, data, method = 'POST') {
    const url = new URL(API_URL);
    // Use the URLSearchParams method for robust form data handling
    const formData = new URLSearchParams();
    formData.append('action', action);
    for (const key in data) {
      formData.append(key, data[key]);
    }

    if (method === 'GET') {
      // Append data as query parameters for GET requests
      url.search = formData.toString();
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } else if (method === 'POST') {
      // Send data in the request body for POST requests
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    }
  }

  // Function to add a new subscriber
  addSubscriberForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    
    try {
      const response = await sendToAPI('addSubscriber', { name: name, phone: phone }, 'POST');
      if (response.status === 'success') {
        alert(response.message);
        addSubscriberForm.reset();
      } else {
        alert('حدث خطأ: ' + (response.message || 'غير معروف'));
      }
    } catch (error) {
      alert('حدث خطأ في الاتصال بالخادم: ' + error.message);
    }
  });

  // Function to search for a subscriber
  searchButton.addEventListener('click', async function() {
    const subscriberName = searchInput.value.trim();
    if (subscriberName) {
      try {
        const data = await sendToAPI('getSubscriberData', { name: subscriberName }, 'GET');
        if (data) {
          currentSubscriber = data;
          displaySubscriberDetails(data);
        } else {
          alert('المشترك غير موجود!');
          subscriberDetails.classList.add('hidden');
        }
      } catch (error) {
        alert('حدث خطأ في البحث: ' + error.message);
        subscriberDetails.classList.add('hidden');
      }
    }
  });

  // Function to display subscriber details on the main interface
  function displaySubscriberDetails(subscriber) {
    document.getElementById('display-name').textContent = subscriber.name;
    document.getElementById('display-phone').textContent = subscriber.phone;
    document.getElementById('display-debt').textContent = subscriber.debt + ' دينار عراقي';
    
    if (subscriber.lastActivation) {
      activationInfo.classList.remove('hidden');
      document.getElementById('last-package').textContent = subscriber.lastActivation.package;
      const actDate = new Date(subscriber.lastActivation.activationDate);
      const expDate = new Date(subscriber.lastActivation.expirationDate);
      document.getElementById('last-activation-date').textContent = actDate.toLocaleDateString('ar-IQ');
      document.getElementById('last-expiration-date').textContent = expDate.toLocaleDateString('ar-IQ');
    } else {
      activationInfo.classList.add('hidden');
    }
    
    subscriberDetails.classList.remove('hidden');
  }

  // Open the activation modal
  activateButton.addEventListener('click', function() {
    if (currentSubscriber) {
      document.getElementById('modal-subscriber-name').textContent = currentSubscriber.name;
      loadPackages();
      activationModal.classList.remove('hidden');
    }
  });
  
  // Close the activation modal
  closeActivationModal.addEventListener('click', function() {
    activationModal.classList.add('hidden');
  });

  // Load packages into the dropdown menu
  async function loadPackages() {
    try {
      const packages = await sendToAPI('getPackages', {}, 'GET');
      packagesSelect.innerHTML = '<option value="">-- اختر باقة --</option>';
      packages.forEach(pkg => {
        const option = document.createElement('option');
        option.value = pkg.name;
        option.dataset.price = pkg.price;
        option.textContent = `${pkg.name} (${pkg.price} دينار عراقي)`;
        packagesSelect.appendChild(option);
      });
      updatePriceAndDates();
    } catch (error) {
      console.error('Error loading packages:', error);
      alert('تعذر تحميل الباقات. يرجى التحقق من اتصالك بالإنترنت.');
    }
  }
  
  // Update price and dates when a package is selected
  packagesSelect.addEventListener('change', updatePriceAndDates);

  function updatePriceAndDates() {
    const selectedOption = packagesSelect.options[packagesSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
      const price = selectedOption.dataset.price;
      priceInput.value = price;
      
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(today.getMonth() + 1);
      
      activationDateInput.value = today.toLocaleDateString('ar-IQ');
      expirationDateInput.value = nextMonth.toLocaleDateString('ar-IQ');
    } else {
      priceInput.value = '';
      activationDateInput.value = '';
      expirationDateInput.value = '';
    }
  }

  // Submit activation form
  activationForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const selectedPackage = packagesSelect.value;
    const price = priceInput.value;
    
    if (selectedPackage && price && currentSubscriber) {
      const activationData = {
        subscriberId: currentSubscriber.id,
        package: selectedPackage,
        price: price
      };
      
      try {
        const response = await sendToAPI('activateSubscription', activationData, 'POST');
        if (response.status === 'success') {
          alert(response.message);
          activationModal.classList.add('hidden');
          // Update subscriber details after activation
          searchButton.click();
          
          const activationDate = activationDateInput.value;
          const expirationDate = expirationDateInput.value;
          const message = `تحية طيبة عزيزي المشترك ${currentSubscriber.name}, تم تفعيل اشتراكك بباقة ${selectedPackage} بسعر ${price} دينار عراقي. تاريخ التفعيل: ${activationDate}, تاريخ الانتهاء: ${expirationDate}. شكراً لاختيارك خدمتنا.`;
          const whatsappURL = `https://wa.me/${currentSubscriber.phone}?text=${encodeURIComponent(message)}`;
          window.open(whatsappURL, '_blank');
        } else {
          alert('حدث خطأ في التفعيل: ' + (response.message || 'غير معروف'));
        }
      } catch (error) {
        alert('حدث خطأ في الاتصال بالخادم: ' + error.message);
      }
    } else {
      alert('الرجاء اختيار باقة لتفعيل الاشتراك.');
    }
  });

  // Open the payment modal
  payButton.addEventListener('click', function() {
    if (currentSubscriber) {
      document.getElementById('payment-modal-name').textContent = currentSubscriber.name;
      paymentModal.classList.remove('hidden');
    }
  });

  // Close the payment modal
  closePaymentModal.addEventListener('click', function() {
    paymentModal.classList.add('hidden');
  });

  // Submit payment form
  paymentForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const amount = document.getElementById('payment-amount').value;
    if (amount > 0 && currentSubscriber) {
      const paymentData = {
        subscriberId: currentSubscriber.id,
        amount: amount
      };
      
      try {
        const response = await sendToAPI('payDebt', paymentData, 'POST');
        if (response.status === 'success') {
          alert(response.message);
          paymentModal.classList.add('hidden');
          searchButton.click();
        } else {
          alert('حدث خطأ في التسجيل: ' + (response.message || 'غير معروف'));
        }
      } catch (error) {
        alert('حدث خطأ في الاتصال بالخادم: ' + error.message);
      }
    } else {
      alert('الرجاء إدخال مبلغ صحيح.');
    }
  });
});