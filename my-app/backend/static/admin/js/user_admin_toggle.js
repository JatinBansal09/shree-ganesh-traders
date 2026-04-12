(function() {
    function init() {
        const staffCheck = document.getElementById('id_is_staff');
        const superCheck = document.getElementById('id_is_superuser');
        
        // List of IDs for the customer fields
        const customerFields = [
            'customer_name', 
            'phone_number', 
            'gst_id', 
            'customer_address', 
            'customer_type'
        ];

        function toggleFields() {
            const shouldHide = staffCheck.checked || superCheck.checked;
            
            customerFields.forEach(fieldName => {
                // Django Admin wraps each field in a div with a class like 'field-customer_name'
                const container = document.querySelector(`.field-${fieldName}`);
                if (container) {
                    container.style.display = shouldHide ? 'none' : 'block';
                }
            });
        }

        if (staffCheck && superCheck) {
            staffCheck.addEventListener('change', toggleFields);
            superCheck.addEventListener('change', toggleFields);
            toggleFields(); // Run on load
        }
    }

    window.addEventListener('load', function() {
        setTimeout(init, 10);
    });
})();