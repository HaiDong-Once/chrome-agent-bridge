// CSS 规则信息
export interface CSSRuleInfo {
  selector: string;
  properties: Record<string, string>;
  mediaQuery: string | null;
  source: string;
}

// 采集的元素完整数据
export interface CapturedElementData {
  id: string;                          // UUID v4
  timestamp: number;                   // Unix ms
  url: string;
  title: string;
  element: {
    tagName: string;
    html: string;                      // outerHTML
    text: string;                      // textContent
    classes: string[];
    id: string | null;
    attributes: Record<string, string>;
    domPath: string;
  };
  styles: {
    computed: Record<string, string>;
    matched: CSSRuleInfo[];
  };
  screenshot: string | null;
}

// 采集记录摘要（用于列表展示）
export interface CapturedElementSummary {
  id: string;
  timestamp: number;
  url: string;
  tagName: string;
  classes: string[];
  text: string;
}

// Chrome 扩展内部消息格式
export type ExtMessage =
  | { type: 'ACTIVATE_SELECTOR' }
  | { type: 'DEACTIVATE_SELECTOR' }
  | { type: 'ELEMENT_CAPTURED'; payload: CapturedElementData }
  | { type: 'SEND_RESULT'; payload: { success: boolean; id?: string; error?: string } }
  | { type: 'STATUS_REQUEST' }
  | { type: 'TOGGLE_PANEL' };

// POST /capture 请求体
export type CaptureRequest = CapturedElementData;

// POST /capture 成功响应
export interface CaptureResponse {
  success: true;
  id: string;
}

// POST /capture 失败响应
export interface CaptureErrorResponse {
  success: false;
  error: string;
}

// GET /ping 响应
export interface PingResponse {
  status: 'ok';
  timestamp: number;
}
