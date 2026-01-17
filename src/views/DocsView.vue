<template>
  <el-container class="docs-page">
    <el-aside width="200px">
      <div class="name">
        <h2>User Guide</h2>
      </div>
      <el-menu :default-active="currentSlug" router>
        <el-sub-menu index="1">
          <template #title>Getting Started</template>
          <el-menu-item index="/docs/phlynx-introduction">Introduction</el-menu-item>
          <el-menu-item index="/docs/phlynx-tutorial">Quick Start</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="2">
          <template #title>How to Guides</template>
          <el-menu-item index="/docs/how-to-guides">Test</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/docs/phlynx-glossary">Glossary</el-menu-item>
        <el-menu-item index="/docs/faq">FAQs</el-menu-item>
      </el-menu>
    </el-aside>

    <el-main class="markdown-body">
      <component :is="currentPageComponent" v-if="currentPageComponent" />
      <div v-else>
        <h2>Documentation Page Not Found</h2>
        <p>Select a page from the sidebar.</p>
      </div>
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const markdownFiles = import.meta.glob('@docs/*.md', { eager: true })
const docsMap = {}

for (const path in markdownFiles) {
  // Extract the filename without path and extension
  // e.g., "../docs/intro.md" -> "intro"
  const fileName = path.split('/').pop().replace('.md', '')

  // Store the component (Vite puts the component in the 'default' export)
  docsMap[fileName] = markdownFiles[path].default
}

// 3. Determine the current slug from the URL (default to 'phlynx-introduction')
const currentSlug = computed(() => {
  return route.params.slug || 'phlynx-introduction'
})

// 4. Get the matching component
const currentPageComponent = computed(() => {
  return docsMap[currentSlug.value]
})
</script>

<style>
@import 'github-markdown-css/github-markdown.css';

.name {
  padding-left: 10%;
}

.markdown-body {
  padding: 40px;
  max-width: 900px;
}

.docs-page {
  height: 100%;
  overflow: hidden;
}

.el-aside {
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid #dcdfe6;
}

.el-main.markdown-body {
  height: 100%;
  overflow-y: auto;
  padding: 40px;
  box-sizing: border-box;
}
</style>
