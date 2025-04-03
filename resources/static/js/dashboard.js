document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('refreshBtn');
  const loadingEl = document.getElementById('loading');
  const servicesContainer = document.getElementById('services-container');
  
  refreshBtn.addEventListener('click', function() {
    loadServices();
  });
  
  servicesContainer.addEventListener('click', function(e) {
    if (e.target.classList.contains('deregister-btn')) {
      const name = e.target.dataset.name;
      const host = e.target.dataset.host;
      const port = e.target.dataset.port;
      
      if (confirm(`Are you sure you want to deregister ${name} at ${host}:${port}?`)) {
        deregisterService(name, host, port);
      }
    }
  });
  
  function loadServices() {
    loadingEl.classList.remove('hidden');
    
    fetch('/nestro/dashboard/api/services')
      .then(response => response.json())
      .then(services => {
        window.location.reload();
      })
      .catch(error => {
        console.error('Error loading services:', error);
        alert('Failed to load services. Please try again.');
      })
      .finally(() => {
        loadingEl.classList.add('hidden');
      });
  }
  
  function deregisterService(name, host, port) {
    loadingEl.classList.remove('hidden');
    
    fetch(`/nestro/dashboard/api/services/${name}/${host}/${port}`, {
      method: 'DELETE',
    })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          loadServices();
        } else {
          alert('Failed to deregister service. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error deregistering service:', error);
        alert('Failed to deregister service. Please try again.');
      })
      .finally(() => {
        loadingEl.classList.add('hidden');
      });
  }
  
  setInterval(loadServices, 30000);
});