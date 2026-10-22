// Photo lightbox for Drogo's hideouts and sleeping spots.
const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox?.querySelector('img');

if (lightbox && lightboxImg) {
  document.querySelectorAll('.clickable-img').forEach((img) => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.getAttribute('src');
      lightbox.classList.add('active');
    });
  });

  lightbox.addEventListener('click', () => {
    lightbox.classList.remove('active');
    lightboxImg.removeAttribute('src');
  });
}
