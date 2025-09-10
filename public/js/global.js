const btn = document.getElementById("go-back");

if (btn) {
document.getElementById("go-back").addEventListener("click", () => {
  window.location = '/'
})
}



  const burger = document.getElementById("burger");
  const mobileNav = document.getElementById("mobileNav");
  const closeNav = document.getElementById("closeNav");

  burger.addEventListener("click", () => {
    mobileNav.classList.add("active");
  });

  closeNav.addEventListener("click", () => {
    mobileNav.classList.remove("active");
  });

  // סגירה בלחיצה מחוץ לתפריט
  window.addEventListener("click", (e) => {
    if (!mobileNav.contains(e.target) && e.target !== burger) {
      mobileNav.classList.remove("active");
    }
  });