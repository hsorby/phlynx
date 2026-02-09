// Example Frontend Logic
const GITHUB_USER = 'physiomelinks'
const REPO = 'circulatory-autogen-modules'
const BRANCH = 'main'
const BASE_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${REPO}@${BRANCH}/`

async function loadManifest() {
  const response = await fetch(BASE_URL + 'manifests/index.json')
  const manifest = await response.json()
  
  return manifest.collections
}

function getUrlForResource(path) {
  return BASE_URL + path
}

export { loadManifest, getUrlForResource }
