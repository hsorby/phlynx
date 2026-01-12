import { ElNotification } from 'element-plus'

/**
 * A wrapper for ElNotification to make all uses consistent across the application.
 *
 * @param {Object} options
 * @returns
 */
export const notify = (options) => {
  return ElNotification({
    position: 'top-right',
    duration: 4000,
    ...options,
  })
}

// Helper shortcuts
notify.error = (options) => notify({ ...options, type: 'error' })
notify.info = (options) => notify({ ...options, type: 'info' })
notify.success = (options) => notify({ ...options, type: 'success' })
notify.warning = (options) => notify({ ...options, type: 'warning' })
