/** 手机端拍/选图按钮，`conversation.input.right` 槽位。
 *
 *  背景：桌面可以把图片直接拖进输入框，官方输入栏没有"选图"入口，手机端
 *  （尤其 PWA / standalone）既拖不了、也没有相机按钮 → 手机完全发不了图。
 *
 *  做法：**纯前端，零 dsh 本体改动**，三步——
 *   1. 在输入栏右侧控件行注册一个 📷 按钮（order 排在官方发送按钮左侧）；
 *   2. 点击时**在用户手势内同步**创建并 click 一个 `input[type=file]`
 *      —— 必须同步，异步（如 setTimeout / await 之后）iOS 会拒绝打开选择器；
 *      也**不要**设置 `capture` 属性：设了会强制调起相机，反而拿不到相册
 *      （不设时 iOS/Android 的系统选择器才会给出"拍照 / 照片图库 / 浏览"）；
 *      `accept="image/*"` + `multiple` 与官方附件能力对齐；
 *   3. 选好的 File 用一个**合成的 DragEvent('drop')**（真 DataTransfer 装 File）
 *      派发到 document —— 与桌面拖图走**同一条官方附件管线**，图片直接进官方
 *      附件条；压缩、预览、发送、随消息提交全部复用官方行为，不需要任何宿主
 *      路由或上传接口。
 *
 *  兼容边界：合成的 drop 依赖官方在 document（或其祖先）上监听 drop。若官方
 *  将来只在 textarea 本体上监听，把派发目标换成
 *  `document.querySelector('[data-input-scroll] textarea')` 即可（其余不变）。
 */
import type { ReactNode } from 'react'

/** 把 File 列表合成一个 drop 事件交给官方附件管线（与桌面拖图同一路径）。
 *  返回是否成功派发；失败只告警不抛出，避免影响输入栏其余控件。 */
export function injectAsDrop(files: FileList | File[]): boolean {
  try {
    const transfer = new DataTransfer()
    for (const file of Array.from(files)) {
      transfer.items.add(file)
    }
    document.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    }))
    return true
  } catch (error) {
    console.warn('[meow-smooth] photo picker: drop injection failed', error)
    return false
  }
}

/** 唤起系统"拍照 / 相册"选择器。必须在用户手势内同步调用。 */
export function pickImages(onPicked?: (files: FileList | undefined) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  // 不要设 capture：设了会强制走相机，拿不到相册。
  input.style.display = 'none'
  input.addEventListener('change', () => {
    // 用户取消时 input.files 为 null（部分浏览器给空 FileList）→ 统一收敛成 undefined，
    // 便于调用方区分「没选」与「选了但空」。
    const files = input.files !== null && input.files.length > 0 ? input.files : undefined
    onPicked?.(files)
    input.remove()
  })
  // iOS 上 input 需要挂在文档里才稳定触发 change（部分版本）。
  document.body.appendChild(input)
  input.click()
}

export function PhotoPickerButton(): ReactNode {
  const onClick = (): void => {
    pickImages((files) => {
      if (files !== undefined && files.length > 0) {
        injectAsDrop(files)
      }
    })
  }

  return (
    <button
      type="button"
      data-meow-photo-picker
      title="拍照或从相册选择图片"
      aria-label="拍照或从相册选择图片"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M9 3a1 1 0 0 1 .894.553L10.618 5H17a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h1.382l.724-1.447A1 1 0 0 1 9 3Zm3 5.5A4.5 4.5 0 1 0 12 17.5a4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
        />
      </svg>
    </button>
  )
}
