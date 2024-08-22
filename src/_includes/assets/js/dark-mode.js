function loadDarkModePreference() {
  if (window.matchMedia('(prefers-color-scheme: dark)')?.matches) {
    document.body.classList.add('dark-mode');
    document
      .getElementById('dark-mode-enabled')
      .classList.replace('fa-square', 'fa-square-check');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDarkModePreference();
  document
    .getElementById('toggle-dark-mode')
    .addEventListener('click', function () {
      document.body.classList.toggle('dark-mode');
      if (document.body.classList.contains('dark-mode')) {
        document
          .getElementById('dark-mode-enabled')
          .classList.replace('fa-square', 'fa-square-check');
      } else {
        document
          .getElementById('dark-mode-enabled')
          .classList.replace('fa-square-check', 'fa-square');
      }
    });

  document
    .getElementById('toggle-dark-mode')
    .addEventListener('blur', function () {
      document.getElementById('nav-list')?.classList.remove('display-menu');
      document.getElementById('nav-list').ariaExpanded = 'false';
    });
});
