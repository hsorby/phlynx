<template>
  <div class="changelog-content" v-html="parsedChangelog"></div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

// Import the file as a raw string (Vite feature)
// import changelogRaw from '../../CHANGELOG.md?raw' 
const changelogRaw = `# Changelog
`

const md = new MarkdownIt()

const parsedChangelog = computed(() => {
  return md.render(changelogRaw)
})
</script>

<style scoped>
.changelog-content {
  max-height: 400px;
  overflow-y: auto;
  padding: 10px;
  background: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 4px;
}

/* Style the markdown output */
:deep(h1) { font-size: 1.5em; margin-bottom: 0.5em; }
:deep(h2) { font-size: 1.2em; margin-top: 1em; border-bottom: 1px solid #ddd; }
:deep(ul) { padding-left: 20px; }
:deep(li) { margin-bottom: 4px; }
</style>