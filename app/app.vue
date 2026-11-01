<template>
  <div class="app-container">
    <div class="container">
      <div class="header">
        <h1>🔐 关卡进度查询系统</h1>
        <p class="subtitle">快速查询和管理你的通关进度</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">👤 姓名</label>
          <input
            type="text"
            id="username"
            v-model="username"
            placeholder="请输入姓名"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">🔑 密码</label>
          <div class="password-wrapper">
            <input
              type="password"
              id="password"
              v-model="password"
              placeholder="请输入密码"
              required
            />
            <span class="password-hint">已填入默认密码</span>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          <span v-if="loading" class="loading-spinner"></span>
          {{ loading ? '查询中...' : '🚀 查询进度' }}
        </button>
      </form>

      <div v-if="result" class="result">
        <div class="result-header">
          <div class="result-title">
            <h2>✅ 查询结果</h2>
            <span class="user-badge">{{ result.user.name }}</span>
          </div>
          <div class="action-buttons">
            <button @click="setAllComplete" class="btn-action btn-complete" title="将所有关卡设为3星">
              <span class="btn-icon">🏆</span>
              <span class="btn-text">全部通关</span>
            </button>
            <button @click="resetAll" class="btn-action btn-reset" title="清空所有进度">
              <span class="btn-icon">🔄</span>
              <span class="btn-text">全部清零</span>
            </button>
            <button @click="showCustomModal = true" class="btn-action btn-custom" title="自定义修改进度">
              <span class="btn-icon">⚙️</span>
              <span class="btn-text">自定义修改</span>
            </button>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-icon">👤</div>
            <div class="info-content">
              <div class="info-label">用户信息</div>
              <div class="info-details">
                <span class="info-item">{{ result.user.name }}</span>
                <span class="info-divider">·</span>
                <span class="info-item">{{ result.user.gender }}</span>
                <span class="info-divider">·</span>
                <span class="info-item">{{ result.user.cls }}班</span>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon">🎮</div>
            <div class="info-content">
              <div class="info-label">关卡进度</div>
              <div class="info-details">
                <span class="info-item highlight">已通关 {{ completedCount }} 关</span>
                <span class="info-divider">·</span>
                <span class="info-item highlight">当前第 {{ editableProgress.unlocked }} 关</span>
              </div>
            </div>
          </div>
        </div>

        <div class="levels-section">
          <div class="section-header">
            <h3>⭐ 各关卡星级</h3>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (completedCount / TOTAL_LEVELS * 100) + '%' }"></div>
              <span class="progress-text">{{ Math.round(completedCount / TOTAL_LEVELS * 100) }}% 完成</span>
            </div>
          </div>
          <div class="stars-grid">
            <div
              v-for="level in TOTAL_LEVELS"
              :key="level"
              class="level-card"
              :class="{
                unlocked: level === editableProgress.unlocked,
                completed: editableProgress.stars[level]
              }"
            >
              <div class="level-number">{{ level }}</div>
              <div class="stars" :style="getStarStyle(level)">
                {{ getStarDisplay(level) }}
              </div>
              <div
                v-if="level === editableProgress.unlocked"
                class="unlocked-badge"
              >
                当前
              </div>
            </div>
          </div>
        </div>

        <div class="token-section">
          <details>
            <summary>🔑 查看 Token</summary>
            <code class="token-code">{{ result.token }}</code>
          </details>
        </div>
      </div>

      <transition name="fade">
        <div v-if="error" class="alert alert-error">
          <span class="alert-icon">❌</span>
          {{ error }}
        </div>
      </transition>

      <transition name="fade">
        <div v-if="successMsg" class="alert alert-success">
          <span class="alert-icon">✅</span>
          {{ successMsg }}
        </div>
      </transition>

      <!-- 自定义修改弹窗 -->
      <transition name="modal">
        <div v-if="showCustomModal" class="modal-overlay" @click="closeModal">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h3>⚙️ 自定义修改</h3>
              <button @click="closeModal" class="modal-close">×</button>
            </div>

            <div class="modal-body">
              <div class="modal-section">
                <label class="modal-label">📍 当前关卡</label>
                <div class="level-select">
                  <label
                    v-for="level in TOTAL_LEVELS"
                    :key="'unlock-' + level"
                    class="radio-label"
                    :class="{ active: customUnlocked === level }"
                  >
                    <input
                      type="radio"
                      :value="level"
                      v-model="customUnlocked"
                      name="unlocked"
                    />
                    {{ level }}
                  </label>
                </div>
              </div>

              <div class="modal-section">
                <label class="modal-label">⭐ 修改星星</label>
                <div class="star-controls">
                  <div class="level-checkboxes">
                    <label
                      v-for="level in TOTAL_LEVELS"
                      :key="'star-' + level"
                      class="checkbox-label"
                      :class="{ active: selectedLevels.includes(level) }"
                    >
                      <input
                        type="checkbox"
                        :value="level"
                        v-model="selectedLevels"
                      />
                      关卡{{ level }}
                    </label>
                  </div>
                  <div class="star-input-group">
                    <label>星星数：</label>
                    <div class="star-selector">
                      <button
                        v-for="n in [0, 1, 2, 3]"
                        :key="n"
                        type="button"
                        @click="starCount = n"
                        class="star-btn"
                        :class="{ active: starCount === n }"
                      >
                        {{ n === 0 ? '清空' : '★'.repeat(n) }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button @click="updateUnlocked" class="btn-modal btn-primary" :disabled="saving">
                {{ saving ? '保存中...' : '修改当前关卡' }}
              </button>
              <button @click="updateStars" class="btn-modal btn-primary" :disabled="saving || selectedLevels.length === 0">
                {{ saving ? '保存中...' : '修改星星数' }}
              </button>
              <button @click="closeModal" class="btn-modal btn-secondary">
                关闭
              </button>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
const username = ref('')
const password = ref('123456')
const loading = ref(false)
const saving = ref(false)
const result = ref(null)
const error = ref('')
const successMsg = ref('')
const editableProgress = ref({ stars: {}, unlocked: 1 })
const showCustomModal = ref(false)
const customUnlocked = ref(1)
const selectedLevels = ref([])
const starCount = ref(3)

const TOTAL_LEVELS = 20

const completedCount = computed(() => {
  if (!editableProgress.value) return 0
  return Object.keys(editableProgress.value.stars).length
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  successMsg.value = ''
  result.value = null

  try {
    const data = await $fetch('/api/login', {
      method: 'POST',
      body: {
        name: username.value,
        pwd: password.value,
      },
    })

    if (data.ok) {
      result.value = data
      editableProgress.value = JSON.parse(JSON.stringify(data.progress))
      customUnlocked.value = data.progress.unlocked
    } else {
      throw new Error('登录失败，请检查用户名和密码')
    }
  } catch (err) {
    error.value = '❌ 错误：' + err.message
  } finally {
    loading.value = false
  }
}

const setAllComplete = async () => {
  const newProgress = {
    stars: {},
    unlocked: 20
  }

  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    newProgress.stars[i] = 3
  }

  await saveProgressToServer(newProgress)
}

const resetAll = async () => {
  const newProgress = {
    stars: {},
    unlocked: 1
  }

  await saveProgressToServer(newProgress)
}

const updateUnlocked = async () => {
  const newProgress = JSON.parse(JSON.stringify(editableProgress.value))
  newProgress.unlocked = customUnlocked.value

  for (let i = 1; i < customUnlocked.value; i++) {
    newProgress.stars[i] = 3
  }

  await saveProgressToServer(newProgress)
}

const updateStars = async () => {
  if (selectedLevels.value.length === 0) {
    error.value = '❌ 请至少选择一个关卡'
    setTimeout(() => { error.value = '' }, 3000)
    return
  }

  const newProgress = JSON.parse(JSON.stringify(editableProgress.value))

  selectedLevels.value.forEach(level => {
    if (starCount.value === 0) {
      delete newProgress.stars[level]
    } else {
      newProgress.stars[level] = starCount.value
    }
  })

  await saveProgressToServer(newProgress)
  selectedLevels.value = []
}

const saveProgressToServer = async (newProgress) => {
  saving.value = true
  error.value = ''
  successMsg.value = ''

  try {
    await $fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${result.value.token}`
      },
      body: {
        progress: newProgress
      }
    })

    result.value.progress = JSON.parse(JSON.stringify(newProgress))
    editableProgress.value = JSON.parse(JSON.stringify(newProgress))
    customUnlocked.value = newProgress.unlocked

    successMsg.value = '✅ 进度保存成功！'
    setTimeout(() => {
      successMsg.value = ''
    }, 3000)
  } catch (err) {
    error.value = '❌ 保存失败：' + err.message
  } finally {
    saving.value = false
  }
}

const closeModal = () => {
  showCustomModal.value = false
  selectedLevels.value = []
}

const getStarDisplay = (level) => {
  if (!editableProgress.value) return ''

  const stars = editableProgress.value.stars[level]
  if (stars) {
    return '★'.repeat(stars) + '☆'.repeat(3 - stars)
  } else if (level === editableProgress.value.unlocked) {
    return '☆☆☆'
  } else {
    return '🔒'
  }
}

const getStarStyle = (level) => {
  if (!editableProgress.value) return {}

  const stars = editableProgress.value.stars[level]
  if (stars) {
    return { color: '#ffd700' }
  } else if (level === editableProgress.value.unlocked) {
    return { color: '#ffd700' }
  } else {
    return { color: '#ccc' }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow-x: hidden;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 40px;
  max-width: 1000px;
  width: 100%;
  animation: fadeIn 0.5s ease-out;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  color: #333;
  font-size: 32px;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 15px;
}

.login-form {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  color: #555;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 15px;
}

.password-wrapper {
  position: relative;
}

.password-hint {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #667eea;
  font-size: 12px;
  background: white;
  padding: 2px 8px;
  border-radius: 4px;
  pointer-events: none;
  font-weight: 500;
}

input[type='text'],
input[type='password'],
input[type='number'] {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.3s;
  background: white;
}

input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn,
.btn-primary,
.btn-action {
  padding: 14px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.btn-primary {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.result {
  animation: fadeIn 0.5s ease-out;
}

.result-header {
  margin-bottom: 25px;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
}

.result-title h2 {
  color: #333;
  font-size: 24px;
  margin: 0;
}

.user-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-action {
  flex: 1;
  min-width: 140px;
  padding: 12px 20px;
}

.btn-action .btn-icon {
  font-size: 18px;
}

.btn-complete {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

.btn-reset {
  background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}

.btn-custom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-action:hover {
  transform: translateY(-2px);
  opacity: 0.95;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.info-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 15px;
  align-items: flex-start;
  transition: all 0.3s;
}

.info-card:hover {
  background: #f0f4ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.info-icon {
  font-size: 32px;
  line-height: 1;
}

.info-content {
  flex: 1;
}

.info-label {
  color: #666;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-details {
  color: #333;
  font-size: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.info-item {
  font-weight: 500;
}

.info-item.highlight {
  color: #667eea;
  font-weight: 700;
}

.info-divider {
  color: #ccc;
}

.levels-section {
  margin-bottom: 25px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.section-header h3 {
  color: #333;
  font-size: 20px;
  margin: 0;
}

.progress-bar {
  position: relative;
  width: 200px;
  height: 24px;
  background: #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  height: 100%;
  background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
  transition: width 0.5s ease;
}

.progress-text {
  position: absolute;
  width: 100%;
  text-align: center;
  line-height: 24px;
  font-size: 12px;
  font-weight: 700;
  color: #333;
  z-index: 1;
}

.stars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.level-card {
  background: white;
  padding: 16px 12px;
  border-radius: 10px;
  text-align: center;
  border: 2px solid #e0e0e0;
  transition: all 0.3s;
  position: relative;
}

.level-card.completed {
  border-color: #ffd700;
  background: linear-gradient(135deg, #fff9e6 0%, #fffbf0 100%);
}

.level-card.unlocked {
  border-color: #667eea;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.level-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.level-number {
  font-weight: 700;
  color: #667eea;
  font-size: 18px;
  margin-bottom: 8px;
}

.stars {
  font-size: 20px;
  letter-spacing: 2px;
  margin: 8px 0;
}

.unlocked-badge {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  margin-top: 6px;
  font-weight: 600;
}

.token-section {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 10px;
}

.token-section details {
  cursor: pointer;
}

.token-section summary {
  font-weight: 600;
  color: #555;
  user-select: none;
  padding: 5px;
}

.token-section summary:hover {
  color: #667eea;
}

.token-code {
  display: block;
  margin-top: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  word-break: break-all;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #555;
}

.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 10px;
  margin-top: 15px;
  font-weight: 500;
  animation: fadeIn 0.3s ease-out;
}

.alert-icon {
  font-size: 20px;
}

.alert-error {
  background: #fee;
  color: #c33;
  border-left: 4px solid #c33;
}

.alert-success {
  background: #d4edda;
  color: #155724;
  border-left: 4px solid #28a745;
}

.fade-enter-active, .fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 0;
  max-width: 700px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px 30px;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h3 {
  color: #333;
  margin: 0;
  font-size: 22px;
}

.modal-close {
  width: 36px;
  height: 36px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: #667eea;
  color: white;
  transform: rotate(90deg);
}

.modal-body {
  padding: 25px 30px;
  overflow-y: auto;
  flex: 1;
}

.modal-section {
  margin-bottom: 30px;
}

.modal-section:last-child {
  margin-bottom: 0;
}

.modal-label {
  display: block;
  color: #333;
  font-weight: 700;
  margin-bottom: 15px;
  font-size: 16px;
}

.level-select {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
}

.radio-label,
.checkbox-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 600;
  background: white;
}

.radio-label:hover,
.checkbox-label:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

.radio-label.active,
.checkbox-label.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.radio-label input,
.checkbox-label input {
  display: none;
}

.level-checkboxes {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.star-input-group {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 10px;
}

.star-input-group label {
  font-weight: 600;
  color: #555;
  margin: 0;
}

.star-selector {
  display: flex;
  gap: 8px;
  flex: 1;
}

.star-btn {
  flex: 1;
  padding: 10px 15px;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 14px;
}

.star-btn:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

.star-btn.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-actions {
  display: flex;
  gap: 10px;
  padding: 20px 30px;
  border-top: 2px solid #f0f0f0;
  background: #f8f9fa;
}

.btn-modal {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-modal.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-modal.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-modal.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-modal:hover:not(:disabled) {
  transform: translateY(-2px);
  opacity: 0.95;
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9) translateY(20px);
}

@media (max-width: 768px) {
  .container {
    padding: 25px;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-action {
    width: 100%;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .progress-bar {
    width: 100%;
  }

  .stars-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }

  .level-select {
    grid-template-columns: repeat(5, 1fr);
  }

  .level-checkboxes {
    grid-template-columns: repeat(3, 1fr);
  }

  .modal-actions {
    flex-direction: column;
  }
}
</style>
