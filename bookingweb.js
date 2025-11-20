// DOM Elements
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const authModal = document.getElementById('auth-modal');
const closeModal = document.querySelector('.close');
const tabBtns = document.querySelectorAll('.tab-btn');
const authForms = document.querySelectorAll('.auth-form');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const bookingOptions = document.querySelectorAll('.booking-option');
const eventHallForm = document.getElementById('event-hall-form');
const dineInForm = document.getElementById('dine-in-form');
const paymentSection = document.getElementById('payment-section');
const confirmationSection = document.getElementById('confirmation-section');
const backBtns = document.querySelectorAll('.back-btn');
const menuCategoryBtns = document.querySelectorAll('.menu-category-btn');
const menuCategories = document.querySelectorAll('.menu-category');
const quantityBtns = document.querySelectorAll('.quantity-btn');
const submitPaymentBtn = document.getElementById('submit-payment');
const newBookingBtn = document.getElementById('new-booking');
const paymentOptions = document.querySelectorAll('input[name="payment-method"]');
const mobileWalletPayment = document.getElementById('mobile-wallet-payment');
const bankTransferPayment = document.getElementById('bank-transfer-payment');
const userInfoSection = document.getElementById('user-info');
const bookingTypeSection = document.getElementById('booking-type');
const editProfileBtn = document.getElementById('edit-profile');

// Application State
let currentUser = null;
let currentBooking = {
    type: '',
    details: {},
    preOrder: [],
    totalAmount: 0,
    bookingId: '',
    paymentDeadline: ''
};
let orderItems = {};
let isEditingProfile = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkLoginStatus();
});

// Event Listeners
function initializeEventListeners() {
    // Authentication
    loginBtn.addEventListener('click', openAuthModal);
    signupBtn.addEventListener('click', openAuthModal);
    closeModal.addEventListener('click', closeAuthModal);
    
    // Auth Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchAuthTab(tab);
        });
    });
    
    // Auth Forms
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    
    // Booking Type Selection
    bookingOptions.forEach(option => {
        option.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            selectBookingType(type);
        });
    });
    
    // Back Buttons
    backBtns.forEach(btn => {
        btn.addEventListener('click', goBack);
    });
    
    // Menu Categories
    menuCategoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            switchMenuCategory(category);
        });
    });
    
    // Subcategory Buttons (for Ala Carte)
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('sub-category-btn')) {
            const subcategory = e.target.getAttribute('data-subcategory');
            switchSubcategory(subcategory);
        }
    });
    
    // Quantity Buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('quantity-btn')) {
            handleQuantityChange(e.target);
        }
    });
    
    // Booking Forms
    document.getElementById('event-form').addEventListener('submit', handleEventBooking);
    document.getElementById('reservation-form').addEventListener('submit', handleDineInBooking);
    
    // Payment Method Selection
    paymentOptions.forEach(option => {
        option.addEventListener('change', function() {
            updatePaymentDetails(this.value);
        });
    });
    
    // Submit Payment
    submitPaymentBtn.addEventListener('click', submitPayment);
    
    // New Booking
    newBookingBtn.addEventListener('click', resetBooking);
    
    // Edit Profile
    editProfileBtn.addEventListener('click', toggleEditProfile);
}

// Check if user is logged in
function checkLoginStatus() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        updateUserInfo();
        showUserInfo();
    }
}

// Update user info display
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-fullname').textContent = currentUser.fullname;
        document.getElementById('user-birthday').textContent = formatDate(currentUser.birthday);
        document.getElementById('user-contact').textContent = currentUser.contact;
        document.getElementById('user-email').textContent = currentUser.email;
    }
}

// Show user info section
function showUserInfo() {
    userInfoSection.classList.remove('hidden');
    document.getElementById('login-btn').textContent = 'Logout';
    document.getElementById('signup-btn').classList.add('hidden');
}

// Hide user info section
function hideUserInfo() {
    userInfoSection.classList.add('hidden');
    document.getElementById('login-btn').textContent = 'Login';
    document.getElementById('signup-btn').classList.remove('hidden');
}

// Authentication Functions
function openAuthModal() {
    if (currentUser) {
        // If user is logged in, logout
        localStorage.removeItem('currentUser');
        currentUser = null;
        hideUserInfo();
        resetBooking();
        return;
    }
    
    authModal.style.display = 'block';
}

function closeAuthModal() {
    authModal.style.display = 'none';
    // Reset forms when closing modal
    loginForm.reset();
    signupForm.reset();
}

function switchAuthTab(tab) {
    // Update active tab
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tab) {
            btn.classList.add('active');
        }
    });
    
    // Show corresponding form
    authForms.forEach(form => {
        form.classList.remove('active');
        if (form.id === `${tab}-form`) {
            form.classList.add('active');
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    
    const contact = document.getElementById('login-contact').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/api/customer/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contact, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            updateUserInfo();
            showUserInfo();
            closeAuthModal();
            alert('Login successful!');
        } else {
            alert(data.message || 'Login failed. Please check your credentials and try again.');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const fullname = document.getElementById('fullname').value;
    const birthday = document.getElementById('birthday').value;
    const contact = document.getElementById('contact').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const privacyConsent = document.getElementById('privacy-consent');
    
    // Privacy Consent Validation
    if (!privacyConsent || !privacyConsent.checked) {
        alert('❌ DATA PRIVACY CONSENT REQUIRED\n\nYou must read and agree to our Data Privacy Policy before creating an account.');
        
        const consentSection = document.querySelector('.privacy-consent');
        if (consentSection) {
            consentSection.style.border = '3px solid #e74c3c';
            consentSection.style.boxShadow = '0 0 20px rgba(231, 76, 60, 0.5)';
            consentSection.style.animation = 'shake 0.6s';
            
            setTimeout(() => {
                consentSection.style.border = '2px solid var(--primary-green)';
                consentSection.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                consentSection.style.animation = '';
            }, 3000);
        }
        
        privacyConsent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    // Validation
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        const response = await fetch('/api/customer/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fullname, birthday, contact, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // STEP 6: Show development verification info
            showDevelopmentVerification(data.message, email, data.verificationToken);
            closeAuthModal();
        } else {
            alert(data.message || 'Signup failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed. Please try again.');
    }
}

// STEP 6: Development Verification Function
function showDevelopmentVerification(message, email, token) {
    const verificationLink = `http://localhost:3000/api/verify-email?token=${token}`;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
            <div style="color: #2ecc71; font-size: 48px; margin-bottom: 20px;">🚀</div>
            <h2 style="color: #2d5016; margin-bottom: 20px;">Development Mode Active</h2>
            <p style="margin-bottom: 20px; line-height: 1.6;">${message}</p>
            
            <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left;">
                <h4 style="color: #2d5016; margin-bottom: 10px;">🔗 Verification Link</h4>
                <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 10px 0;">Click the button below to verify immediately:</p>
                
                <div style="text-align: center; margin: 15px 0;">
                    <a href="${verificationLink}" target="_blank" 
                       style="background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); 
                              color: white; 
                              padding: 12px 25px; 
                              text-decoration: none; 
                              border-radius: 25px; 
                              display: inline-block;
                              font-weight: bold;">
                        Verify Email Now
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #666; margin: 10px 0;">
                    Or copy this link: <br>
                    <code style="background: #f8f9fa; padding: 8px; border-radius: 5px; word-break: break-all; display: inline-block; margin-top: 5px; font-size: 12px;">
                        ${verificationLink}
                    </code>
                </p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                <strong>Note:</strong> In production, this link would be sent via email.
            </p>
            
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); 
                           color: white; 
                           border: none; 
                           padding: 12px 25px; 
                           border-radius: 25px; 
                           cursor: pointer; 
                           font-weight: bold;
                           margin-top: 20px;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Profile Editing
function toggleEditProfile() {
    if (!isEditingProfile) {
        enableEditProfile();
    } else {
        saveProfile();
    }
}

function enableEditProfile() {
    isEditingProfile = true;
    
    const userDetails = document.querySelector('.user-details');
    userDetails.innerHTML = `
        <div class="form-group">
            <label for="edit-fullname">Full Name</label>
            <input type="text" id="edit-fullname" value="${currentUser.fullname}" required>
        </div>
        <div class="form-group">
            <label for="edit-birthday">Birthday</label>
            <input type="date" id="edit-birthday" value="${currentUser.birthday}" required>
        </div>
        <div class="form-group">
            <label for="edit-contact">Contact Number</label>
            <input type="text" id="edit-contact" value="${currentUser.contact}" required>
        </div>
        <div class="form-group">
            <label for="edit-email">Email</label>
            <input type="email" id="edit-email" value="${currentUser.email}" required>
        </div>
    `;
    
    editProfileBtn.textContent = 'Save Changes';
    editProfileBtn.style.backgroundColor = '#2ecc71';
}

async function saveProfile() {
    const fullname = document.getElementById('edit-fullname').value;
    const birthday = document.getElementById('edit-birthday').value;
    const contact = document.getElementById('edit-contact').value;
    const email = document.getElementById('edit-email').value;
    
    try {
        const response = await fetch('/api/customer/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userId: currentUser.id,
                fullname, 
                birthday, 
                contact, 
                email 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            updateUserInfo();
            isEditingProfile = false;
            editProfileBtn.textContent = 'Edit Profile';
            editProfileBtn.style.backgroundColor = '';
            alert('Profile updated successfully!');
        } else {
            alert(data.message || 'Profile update failed');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        alert('Profile update failed. Please try again.');
    }
}

// Booking Functions
function selectBookingType(type) {
    // Check if user is logged in
    if (!currentUser) {
        alert('Please login to make a booking.');
        openAuthModal();
        return;
    }

    // Hide booking type selection
    bookingTypeSection.classList.add('hidden');
    
    // Hide ALL forms first
    eventHallForm.classList.add('hidden');
    dineInForm.classList.add('hidden');
    paymentSection.classList.add('hidden');
    confirmationSection.classList.add('hidden');
    
    // Show ONLY the appropriate form
    if (type === 'event-hall') {
        eventHallForm.classList.remove('hidden');
        currentBooking.type = 'event-hall';
    } else if (type === 'dine-in') {
        dineInForm.classList.remove('hidden');
        currentBooking.type = 'dine-in';
        initializeMenu();
    }
}

function goBack() {
    // Hide all forms
    eventHallForm.classList.add('hidden');
    dineInForm.classList.add('hidden');
    paymentSection.classList.add('hidden');
    confirmationSection.classList.add('hidden');
    
    // Show booking type selection
    bookingTypeSection.classList.remove('hidden');
}

function switchMenuCategory(category) {
    // Update active category button
    menuCategoryBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === category) {
            btn.classList.add('active');
        }
    });
    
    // Show selected category
    menuCategories.forEach(cat => {
        cat.classList.remove('active');
        if (cat.getAttribute('data-category') === category) {
            cat.classList.add('active');
        }
    });
    
    // If switching to ala-carte, make sure first subcategory is active
    if (category === 'ala-carte') {
        const firstSubBtn = document.querySelector('.sub-category-btn[data-subcategory="chicken"]');
        if (firstSubBtn) {
            switchSubcategory('chicken');
        }
    }
}

function switchSubcategory(subcategory) {
    // Update active subcategory button
    const subcategoryBtns = document.querySelectorAll('.sub-category-btn');
    subcategoryBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-subcategory') === subcategory) {
            btn.classList.add('active');
        }
    });
    
    // Show selected subcategory
    const subMenuCategories = document.querySelectorAll('.sub-menu-category');
    subMenuCategories.forEach(cat => {
        cat.classList.remove('active');
        if (cat.getAttribute('data-subcategory') === subcategory) {
            cat.classList.add('active');
        }
    });
}

function handleQuantityChange(button) {
    const menuItem = button.closest('.menu-item');
    const quantityElement = menuItem.querySelector('.quantity');
    let quantity = parseInt(quantityElement.textContent);
    
    if (button.classList.contains('plus')) {
        quantity++;
    } else if (button.classList.contains('minus') && quantity > 0) {
        quantity--;
    }
    
    quantityElement.textContent = quantity;
    updateOrderSummary();
}

function initializeMenu() {
    // Reset all quantities to 0
    document.querySelectorAll('.quantity').forEach(qty => {
        qty.textContent = '0';
    });
    
    // Clear order items container
    document.getElementById('order-items').innerHTML = '';
    
    // Reset total
    document.getElementById('order-total-amount').textContent = '0.00';
    
    orderItems = {};
}

function updateOrderSummary() {
    const orderItemsContainer = document.getElementById('order-items');
    const orderTotalElement = document.getElementById('order-total-amount');
    let total = 0;
    
    // Clear current order items
    orderItemsContainer.innerHTML = '';
    
    // Get all menu items with quantity > 0
    document.querySelectorAll('.menu-item').forEach(item => {
        const quantity = parseInt(item.querySelector('.quantity').textContent);
        if (quantity > 0) {
            const itemName = item.querySelector('h4').textContent;
            const priceText = item.querySelector('.price').textContent;
            const price = parseFloat(priceText.replace('₱', '').replace(',', ''));
            const itemTotal = price * quantity;
            
            total += itemTotal;
            
            const orderItem = document.createElement('div');
            orderItem.className = 'order-item';
            orderItem.innerHTML = `
                <span>${itemName} x${quantity}</span>
                <span>₱${itemTotal.toFixed(2)}</span>
            `;
            orderItemsContainer.appendChild(orderItem);
            
            // Store in orderItems object
            orderItems[itemName] = {
                quantity: quantity,
                price: price,
                total: itemTotal
            };
        }
    });
    
    orderTotalElement.textContent = total.toFixed(2);
    currentBooking.totalAmount = total;
    currentBooking.preOrder = orderItems;
}

function handleEventBooking(e) {
    e.preventDefault();
    
    // Check if user is logged in
    if (!currentUser) {
        alert('Please login to make a booking.');
        openAuthModal();
        return;
    }
    
    // Collect form data
    const eventType = document.getElementById('event-type').value;
    const eventDate = document.getElementById('event-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const guestCount = document.getElementById('guest-count').value; // Fixed: changed from 'guests' to 'guest-count'
    const specialRequests = document.getElementById('special-requests').value;
    
    // Validate required fields
    if (!eventType || !eventDate || !startTime || !endTime || !guestCount) {
        alert('Please fill in all required fields.');
        return;
    }
    
    // Store booking details
    currentBooking.details = {
        eventType,
        eventDate,
        startTime,
        endTime,
        guestCount, // Fixed: changed from 'guests' to 'guestCount'
        specialRequests
    };
    
    // Calculate total amount
    currentBooking.totalAmount = calculateEventPrice(guestCount, eventType); // Fixed: use guestCount instead of guests
    
    // Generate booking ID and payment deadline
    currentBooking.bookingId = generateBookingId();
    currentBooking.paymentDeadline = calculatePaymentDeadline();
    
    console.log('Event Booking Details:', currentBooking); // Debug log
    
    // Proceed to payment
    showPaymentSection();
}

function handleDineInBooking(e) {
    e.preventDefault();
    
    // Check if user is logged in
    if (!currentUser) {
        alert('Please login to make a booking.');
        openAuthModal();
        return;
    }
    
    // Collect form data
    const reservationDate = document.getElementById('reservation-date').value;
    const reservationTime = document.getElementById('reservation-time').value;
    const partySize = document.getElementById('party-size').value;
    const tablePreference = document.getElementById('table-preference').value;
    
    // Store booking details
    currentBooking.details = {
        reservationDate,
        reservationTime,
        partySize,
        tablePreference
    };
    
    // Add pre-order total if any
    if (currentBooking.totalAmount > 0) {
        currentBooking.totalAmount += calculateDineInPrice(partySize);
    } else {
        currentBooking.totalAmount = calculateDineInPrice(partySize);
    }
    
    // Generate booking ID and payment deadline
    currentBooking.bookingId = generateBookingId();
    currentBooking.paymentDeadline = calculatePaymentDeadline();
    
    // Proceed to payment
    showPaymentSection();
}

function calculateEventPrice(guests, eventType) {
    // Base pricing logic
    let basePrice = 0;
    
    switch(eventType) {
        case 'wedding':
            basePrice = 50000;
            break;
        case 'birthday':
            basePrice = 20000;
            break;
        case 'corporate':
            basePrice = 30000;
            break;
        case 'reunion':
            basePrice = 15000;
            break;
        default:
            basePrice = 10000;
    }
    
    // Additional charge per guest beyond 50
    const guestCount = parseInt(guests);
    if (guestCount > 50) {
        basePrice += (guestCount - 50) * 500;
    }
    
    return basePrice;
}

function calculateDineInPrice(partySize) {
    // Base price per person for dine-in reservation
    const pricePerPerson = 500;
    return parseInt(partySize) * pricePerPerson;
}

function showPaymentSection() {
    // Hide current form
    eventHallForm.classList.add('hidden');
    dineInForm.classList.add('hidden');
    
    // Show payment section
    paymentSection.classList.remove('hidden');
    
    // Update payment details
    updatePaymentSummary();
}

function updatePaymentSummary() {
    // Update booking ID and payment deadline
    document.getElementById('booking-id').textContent = currentBooking.bookingId;
    document.getElementById('payment-deadline').textContent = formatDateTime(currentBooking.paymentDeadline);
    
    // Update UI
    document.getElementById('total-amount').textContent = currentBooking.totalAmount.toFixed(2);
    document.getElementById('downpayment-amount').textContent = (currentBooking.totalAmount * 0.5).toFixed(2);
    
    // Update booking details
    const bookingDetails = document.getElementById('booking-details');
    let detailsHTML = '';
    
    if (currentBooking.type === 'event-hall') {
        detailsHTML = `
            <p><strong>Event Type:</strong> ${currentBooking.details.eventType}</p>
            <p><strong>Date:</strong> ${formatDate(currentBooking.details.eventDate)}</p>
            <p><strong>Time:</strong> ${currentBooking.details.startTime} - ${currentBooking.details.endTime}</p>
            <p><strong>Guests:</strong> ${currentBooking.details.guestCount}</p>
            ${currentBooking.details.specialRequests ? `<p><strong>Special Requests:</strong> ${currentBooking.details.specialRequests}</p>` : ''}
        `;
    } else {
        detailsHTML = `
            <p><strong>Reservation Date:</strong> ${formatDate(currentBooking.details.reservationDate)}</p>
            <p><strong>Time:</strong> ${currentBooking.details.reservationTime}</p>
            <p><strong>Party Size:</strong> ${currentBooking.details.partySize}</p>
            <p><strong>Table Preference:</strong> ${currentBooking.details.tablePreference}</p>
        `;
        
        // Add pre-order summary if any
        if (Object.keys(currentBooking.preOrder).length > 0) {
            detailsHTML += `<p><strong>Pre-Order Total:</strong> ₱${currentBooking.totalAmount.toFixed(2)}</p>`;
        }
    }
    
    bookingDetails.innerHTML = detailsHTML;
}

function updatePaymentDetails(method) {
    // Hide all payment details
    mobileWalletPayment.classList.add('hidden');
    bankTransferPayment.classList.add('hidden');
    
    // Show selected payment method
    if (method === 'gcash' || method === 'paymaya') {
        mobileWalletPayment.classList.remove('hidden');
        document.getElementById('mobile-amount').textContent = (currentBooking.totalAmount * 0.5).toFixed(2);
        document.getElementById('reservation-id-mobile').textContent = currentBooking.bookingId;
    } else if (method === 'bank-transfer') {
        bankTransferPayment.classList.remove('hidden');
        document.getElementById('bank-amount').textContent = (currentBooking.totalAmount * 0.5).toFixed(2);
    }
}

function submitPayment() {
    if (!currentUser) {
        alert('Please login to complete your booking');
        return;
    }
    
    const selectedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');
    if (!selectedPaymentMethod) {
        alert('Please select a payment method');
        return;
    }
    
    // Validate payment details based on method
    if (selectedPaymentMethod.value === 'gcash' || selectedPaymentMethod.value === 'paymaya') {
        const screenshot = document.getElementById('payment-screenshot').files[0];
        if (!screenshot) {
            alert('Please upload payment screenshot');
            return;
        }
    } else if (selectedPaymentMethod.value === 'bank-transfer') {
        const transactionRef = document.getElementById('transaction-ref').value;
        const bankName = document.getElementById('bank-name').value;
        const amountPaid = document.getElementById('amount-paid').value;
        const paymentDate = document.getElementById('payment-date').value;
        
        if (!transactionRef || !bankName || !amountPaid || !paymentDate) {
            alert('Please fill all bank transfer details');
            return;
        }
    }
    
    // Save booking to database
    saveBookingToDatabase();
}

async function saveBookingToDatabase() {
    const selectedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');
    const paymentMethod = selectedPaymentMethod ? selectedPaymentMethod.value : '';
    
    let paymentDetails = {};
    if (paymentMethod === 'gcash' || paymentMethod === 'paymaya') {
        paymentDetails = {
            method: paymentMethod,
            screenshot: 'uploaded'
        };
    } else if (paymentMethod === 'bank-transfer') {
        paymentDetails = {
            method: paymentMethod,
            transactionRef: document.getElementById('transaction-ref').value,
            bankName: document.getElementById('bank-name').value,
            amountPaid: document.getElementById('amount-paid').value,
            paymentDate: document.getElementById('payment-date').value
        };
    }
    
    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: currentUser.id,
                bookingType: currentBooking.type,
                details: currentBooking.details,
                preOrder: currentBooking.preOrder,
                totalAmount: currentBooking.totalAmount,
                paymentMethod: paymentMethod,
                paymentDetails: paymentDetails
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showConfirmation();
        } else {
            alert(data.message || 'Booking failed');
        }
    } catch (error) {
        console.error('Booking error:', error);
        alert('Booking failed. Please try again.');
    }
}

function showConfirmation() {
    paymentSection.classList.add('hidden');
    confirmationSection.classList.remove('hidden');
    
    // Update confirmation details
    document.getElementById('confirmed-booking-id').textContent = currentBooking.bookingId;
    document.getElementById('confirmed-date').textContent = formatDate(currentBooking.details.eventDate || currentBooking.details.reservationDate);
    document.getElementById('confirmed-deadline').textContent = formatDateTime(currentBooking.paymentDeadline);
}

function resetBooking() {
    // Reset booking state
    currentBooking = {
        type: '',
        details: {},
        preOrder: [],
        totalAmount: 0,
        bookingId: '',
        paymentDeadline: ''
    };
    
    // Reset forms
    document.getElementById('event-form').reset();
    document.getElementById('reservation-form').reset();
    
    // Reset UI
    confirmationSection.classList.add('hidden');
    bookingTypeSection.classList.remove('hidden');
    
    // Reset menu
    initializeMenu();
}

// Utility Functions
function generateBookingId() {
    return 'WNM' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function calculatePaymentDeadline() {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 2); // 2 hours from now
    return deadline;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatDateTime(dateTime) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateTime).toLocaleDateString(undefined, options);
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target === authModal) {
        closeAuthModal();
    }
});

// Prevent modal from closing when clicking inside
authModal.addEventListener('click', function(event) {
    event.stopPropagation();
});