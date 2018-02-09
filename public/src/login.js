document.getElementById('login').addEventListener('click', () => {
  let xhr = new XMLHttpRequest()
  xhr.open('GET', 'http://localhost:9999/login')
  xhr.send()
})