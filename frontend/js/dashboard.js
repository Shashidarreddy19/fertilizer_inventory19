// Handle smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    if (!checkAuth()) {
        // If not authenticated, ensure profile section is hidden
        const authButtons = document.getElementById('authButtons');
        const profileSection = document.getElementById('profileSection');
        if (authButtons) authButtons.style.display = 'flex';
        if (profileSection) profileSection.style.display = 'none';
        return;
    }

    // Profile section functionality
    const authButtons = document.getElementById('authButtons');
    const profileSection = document.getElementById('profileSection');
    const shopName = document.getElementById('shopName');
    const viewProfile = document.getElementById('viewProfile');
    const logoutBtn = document.getElementById('logoutBtn');

    // Check if user is logged in
    const userId = localStorage.getItem('userId');
    const userData = localStorage.getItem('user');
    
    if (userId && userData) {
        try {
            const user = JSON.parse(userData);
            // Show profile section
            if (authButtons) authButtons.style.display = 'none';
            if (profileSection) {
                profileSection.style.display = 'flex';
                shopName.textContent = user.shop_name || 'My Shop';
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            // Show login/signup buttons on error
            if (authButtons) authButtons.style.display = 'flex';
            if (profileSection) profileSection.style.display = 'none';
            // Redirect to login page on error
            window.location.href = 'loginpage.html';
            return;
        }
    } else {
        // Not logged in, show login/signup buttons and redirect
        if (authButtons) authButtons.style.display = 'flex';
        if (profileSection) profileSection.style.display = 'none';
        window.location.href = 'loginpage.html';
        return;
    }

    // Handle profile dropdown
    const profileInfo = document.querySelector('.profile-info');
    const dropdown = document.querySelector('.profile-dropdown');
    
    if (profileInfo && dropdown) {
        profileInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileSection.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    // Handle view profile
    if (viewProfile) {
        const modal = document.getElementById('profileModal');
        const closeModal = document.querySelector('.close-modal');
        const closeButton = document.querySelector('.btn-close');

        viewProfile.addEventListener('click', (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('user'));
            
            // Update modal content
            document.getElementById('modalShopName').textContent = user.shop_name || 'N/A';
            document.getElementById('modalOwnerName').textContent = user.owner_name || 'N/A';
            document.getElementById('modalEmail').textContent = user.email || 'N/A';
            document.getElementById('modalPhone').textContent = user.phone || 'N/A';
            
            // Show modal
            modal.style.display = 'block';
            // Close dropdown
            dropdown.classList.remove('show');
        });

        // Close modal when clicking the close button
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close modal when clicking the close button in footer
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('userId');
            localStorage.removeItem('lastAuthTime');
            localStorage.removeItem('user');
            window.location.href = 'loginpage.html';
        });
    }

    // Handle smooth scroll functionality
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Handle contact form submission
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formMessage = document.querySelector('.form-message');
            formMessage.textContent = 'Thank you for your message. We will get back to you soon!';
            formMessage.style.color = '#4CAF50';
            this.reset();
        });
    }

    // Mobile navigation handling
    const navLinks = document.querySelector('.nav-links');
    if (window.innerWidth <= 768) {
        navLinks.style.display = 'none';
        
        if (!document.querySelector('.mobile-menu-toggle')) {
            const toggleButton = document.createElement('button');
            toggleButton.className = 'mobile-menu-toggle';
            toggleButton.innerHTML = '<i class="fas fa-bars"></i>';
            document.querySelector('nav').prepend(toggleButton);

            toggleButton.addEventListener('click', () => {
                const currentDisplay = navLinks.style.display;
                navLinks.style.display = currentDisplay === 'none' ? 'flex' : 'none';
            });
        }
    }
});

// Add checkAuth function at the end
function checkAuth() {
    const userId = localStorage.getItem('userId');
    const lastAuthTime = localStorage.getItem('lastAuthTime');
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    if (!userId || !lastAuthTime) {
        return false;
    }

    const currentTime = new Date().getTime();
    if (currentTime - parseInt(lastAuthTime) >= sessionTimeout) {
        // Clear session data and return false
        localStorage.removeItem('userId');
        localStorage.removeItem('lastAuthTime');
        localStorage.removeItem('user');
        return false;
    }

    return true;
} 