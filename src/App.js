import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Smartphone,
  Laptop,
  Watch,
  Calculator,
  Calendar,
  DollarSign,
  X,
  Sparkles,
  Wand2,
  Loader2,
  Camera,
  AlertCircle,
  Gamepad2,
  Headphones,
  Tv,
  Package,
  Upload,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";

// --- DeepSeek API 配置 ---
// 1. 请前往 https://platform.deepseek.com/ 申请 API Key
// 2. 将 Key 粘贴在下方引号中，例如 "sk-xxxxxxxx"
const apiKey = "sk-bc129c352ab74a99ace67dcce1d6febb";

export default function App() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("manual");

  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    date: "",
    type: "phone",
    image: null,
  });

  // AI 状态
  const [smartInput, setSmartInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 图片相关 (DeepSeek 暂不支持图片识别，保留手动上传功能)
  const manualFileInputRef = useRef(null);

  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    const savedItems = localStorage.getItem("my_devices");
    if (savedItems) {
      setItems(JSON.parse(savedItems));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("my_devices", JSON.stringify(items));
  }, [items]);

  const calculateStats = (price, dateStr) => {
    const purchaseDate = new Date(dateStr);
    const today = new Date();
    const timeDiff = Math.abs(today - purchaseDate);
    const daysOwned = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const validDays = daysOwned < 1 ? 1 : daysOwned;
    const dailyCost = (parseFloat(price) / validDays).toFixed(2);
    return { days: validDays, dailyCost };
  };

  // --- DeepSeek API 调用函数 ---
  // DeepSeek 兼容 OpenAI 格式
  const callDeepSeek = async (systemPrompt, userPrompt) => {
    if (!apiKey) throw new Error("请先配置 DeepSeek API Key");

    try {
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat", // 使用 DeepSeek V3 模型
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: false,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "API request failed");
      }
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("DeepSeek Error:", error);
      throw error;
    }
  };

  // 处理手动图片选择
  const handleManualImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("图片太大了，建议上传 2MB 以内的图片");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItem({ ...newItem, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Feature 1: AI 智能录入 (纯文本版) ---
  const handleSmartAdd = async () => {
    if (!smartInput.trim()) {
      setErrorMsg("请输入文字描述。");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg("");

    const systemPrompt = `
      你是一个数据提取助手。请从用户的自然语言描述中提取设备信息，并返回纯 JSON 格式数据。
      当前日期: ${new Date().toISOString().split("T")[0]}
      
      要求：
      1. 只返回 JSON 对象，不要包含 markdown 格式（如 \`\`\`json）。
      2. 字段包括：
         - "name" (string, 设备名称)
         - "price" (number, 价格数字)
         - "date" (string, YYYY-MM-DD 格式。如果是"上个月"等相对时间，请根据当前日期计算)
         - "type" (string, 从以下选择最匹配的一个: 'phone', 'laptop', 'watch', 'console', 'camera', 'audio', 'home', 'other')
    `;

    try {
      const resultText = await callDeepSeek(systemPrompt, smartInput);
      const jsonStr = resultText.replace(/```json|```/g, "").trim();
      const result = JSON.parse(jsonStr);

      setNewItem({
        name: result.name || "",
        price: result.price || "",
        date: result.date || new Date().toISOString().split("T")[0],
        type: result.type || "other",
        image: null,
      });
      setModalMode("manual");
      setSmartInput("");
    } catch (e) {
      console.error(e);
      setErrorMsg(
        e.message === "请先配置 DeepSeek API Key"
          ? "请在代码中填入 API Key"
          : "AI 识别失败，请重试。"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Feature 2: AI 资产分析 (DeepSeek 擅长这个) ---
  const generateReport = async () => {
    if (items.length === 0) return;
    setIsGeneratingReport(true);
    const enrichedItems = items.map((item) => ({
      ...item,
      stats: calculateStats(item.price, item.date),
    }));

    const systemPrompt = "你是一位幽默、犀利的数码理财顾问。";
    const userPrompt = `
      请分析这份设备列表，生成一份中文 HTML 简报。
      数据: ${JSON.stringify(enrichedItems)}
      
      输出格式要求 (HTML):
      <div class="space-y-3">
        <p><strong>🏆 年度理财神机:</strong> [设备名] (日均 [金额] 元) - [一句话犀利点评为什么值]</p>
        <p><strong>💸 败家之眼奖:</strong> [设备名] (日均 [金额] 元) - [一句话点评为什么亏]</p>
        <div class="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-800">
          <strong>📊 深度画像:</strong><br/>
          [2-3句话分析用户的消费习惯和科技品味，风格要幽默有趣，用词稍微"DeepSeek"一点]
        </div>
      </div>
      
      注意：直接返回 HTML 代码，不要包裹在 markdown 中。
    `;

    try {
      const text = await callDeepSeek(systemPrompt, userPrompt);
      const cleanHtml = text.replace(/```html|```/g, "").trim();
      setAiReport(cleanHtml);
    } catch (e) {
      setErrorMsg("生成报告失败，请稍后再试。");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price || !newItem.date) return;
    setItems([{ id: Date.now(), ...newItem }, ...items]);
    setNewItem({ name: "", price: "", date: "", type: "phone", image: null });
    setShowModal(false);
    setModalMode("manual");
    setAiReport(null);
  };

  const requestDelete = (id) => setItemToDelete(id);
  const confirmDelete = () => {
    if (itemToDelete) {
      setItems(items.filter((item) => item.id !== itemToDelete));
      setAiReport(null);
      setItemToDelete(null);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "laptop":
        return <Laptop size={24} className="text-blue-500" />;
      case "watch":
        return <Watch size={24} className="text-purple-500" />;
      case "console":
        return <Gamepad2 size={24} className="text-indigo-500" />;
      case "camera":
        return <Camera size={24} className="text-rose-500" />;
      case "audio":
        return <Headphones size={24} className="text-pink-500" />;
      case "home":
        return <Tv size={24} className="text-amber-500" />;
      case "other":
        return <Package size={24} className="text-slate-400" />;
      default:
        return <Smartphone size={24} className="text-emerald-500" />;
    }
  };

  const totalSpent = items.reduce(
    (acc, item) => acc + parseFloat(item.price || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-24 relative overflow-hidden">
      {/* --- 顶部导航栏 --- */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">我的设备账本</h1>
        {items.length > 0 && (
          <button
            onClick={generateReport}
            disabled={isGeneratingReport}
            className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
          >
            {isGeneratingReport ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {isGeneratingReport ? "深度分析" : "DeepSeek 分析"}
          </button>
        )}
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* --- 概览卡片 --- */}
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg mb-6">
          <div className="text-indigo-100 text-sm mb-1">设备总投入</div>
          <div className="text-3xl font-bold mb-4">
            ¥ {totalSpent.toLocaleString()}
          </div>
          <div className="flex justify-between text-sm opacity-90 border-t border-indigo-500 pt-3">
            <span>设备数量: {items.length}</span>
            <span>每一分钱都在陪伴你</span>
          </div>
        </div>

        {/* --- AI 报告 --- */}
        {aiReport && (
          <div className="mb-6 bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2 mb-4 text-indigo-700 font-bold border-b border-indigo-50 pb-2">
              <Wand2 size={18} />
              <span>DeepSeek 深度报告</span>
            </div>
            <div
              className="text-sm text-slate-700 leading-relaxed space-y-2"
              dangerouslySetInnerHTML={{ __html: aiReport }}
            />
            <button
              onClick={() => setAiReport(null)}
              className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline block w-full text-center"
            >
              收起报告
            </button>
          </div>
        )}

        {/* --- 设备列表 --- */}
        <h2 className="text-slate-500 text-sm font-semibold mb-3 px-1">
          设备清单
        </h2>
        {items.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Calculator size={48} className="mx-auto mb-2 opacity-50" />
            <p>还没有记录，点击右下角添加吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const stats = calculateStats(item.price, item.date);
              return (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative group transition-all active:scale-95"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-slate-100">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getIcon(item.type)
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-lg truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          购买于 {item.date}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDelete(item.id);
                      }}
                      className="text-slate-300 hover:text-red-500 p-2 transition-colors rounded-full hover:bg-red-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 bg-slate-50 p-3 rounded-lg">
                    <div className="text-center border-r border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">
                        陪伴时间
                      </div>
                      <div className="text-indigo-600 font-bold">
                        {stats.days}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          天
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500 mb-1">
                        日均成本
                      </div>
                      <div className="text-emerald-600 font-bold">
                        ¥{stats.dailyCost}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          /天
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setShowModal(true);
          setModalMode("manual");
          setErrorMsg("");
          setSmartInput("");
        }}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-transform active:scale-90 z-20"
      >
        <Plus size={24} />
      </button>

      {/* --- 弹窗 --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold">添加新设备</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b border-slate-100 shrink-0">
              <button
                onClick={() => setModalMode("manual")}
                className={`flex-1 py-3 text-sm font-medium ${
                  modalMode === "manual"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-slate-500"
                }`}
              >
                普通录入
              </button>
              <button
                onClick={() => setModalMode("ai")}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1 ${
                  modalMode === "ai"
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-slate-500"
                }`}
              >
                <Sparkles size={14} /> AI 智能录入
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {modalMode === "ai" ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 mb-2 border border-blue-100">
                    <p className="font-bold mb-1 flex items-center gap-1">
                      <MessageSquare size={12} /> DeepSeek 模式：
                    </p>
                    <p className="opacity-80">
                      请输入一段话，AI 会自动提取设备名、价格和日期。
                    </p>
                    <p className="opacity-60 mt-1 text-[10px]">
                      *
                      暂不支持图片识别，请直接描述，如“昨天京东3000买了个耳机”。
                    </p>
                  </div>

                  <textarea
                    placeholder="例如：2023年双十一买的索尼降噪耳机，花了1299元..."
                    className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] resize-none text-slate-700 text-sm"
                    value={smartInput}
                    onChange={(e) => setSmartInput(e.target.value)}
                  />

                  {errorMsg && (
                    <p className="text-red-500 text-xs">{errorMsg}</p>
                  )}

                  <button
                    onClick={handleSmartAdd}
                    disabled={isAnalyzing || !smartInput.trim()}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        DeepSeek 思考中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        开始识别
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">
                      设备图片 (可选)
                    </label>
                    <div
                      onClick={() => manualFileInputRef.current?.click()}
                      className={`border border-dashed rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        newItem.image
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="file"
                        ref={manualFileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleManualImageSelect}
                      />
                      {newItem.image ? (
                        <div className="relative w-full">
                          <img
                            src={newItem.image}
                            alt="Preview"
                            className="h-32 rounded-lg mx-auto object-contain shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewItem({ ...newItem, image: null });
                            }}
                            className="absolute -top-2 -right-2 bg-slate-500 text-white p-1 rounded-full shadow hover:bg-slate-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 py-2">
                          <Camera size={20} />
                          <span className="text-sm">点击上传实拍图</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-500 mb-1">
                      设备名称
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例如：MacBook Air M2"
                      className="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newItem.name}
                      onChange={(e) =>
                        setNewItem({ ...newItem, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">
                        价格 (元)
                      </label>
                      <div className="relative">
                        <DollarSign
                          size={16}
                          className="absolute left-3 top-3.5 text-slate-400"
                        />
                        <input
                          type="number"
                          required
                          placeholder="8999"
                          className="w-full p-3 pl-9 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newItem.price}
                          onChange={(e) =>
                            setNewItem({ ...newItem, price: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">
                        设备类型
                      </label>
                      <select
                        className="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                        value={newItem.type}
                        onChange={(e) =>
                          setNewItem({ ...newItem, type: e.target.value })
                        }
                      >
                        <option value="phone">手机</option>
                        <option value="laptop">电脑/平板</option>
                        <option value="console">游戏机</option>
                        <option value="camera">相机/镜头</option>
                        <option value="audio">耳机/音响</option>
                        <option value="watch">智能穿戴</option>
                        <option value="home">生活家电</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-500 mb-1">
                      购买日期
                    </label>
                    <div className="relative">
                      <Calendar
                        size={16}
                        className="absolute left-3 top-3.5 text-slate-400"
                      />
                      <input
                        type="date"
                        required
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full p-3 pl-9 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newItem.date}
                        onChange={(e) =>
                          setNewItem({ ...newItem, date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 active:bg-indigo-800 transition-colors mt-2"
                  >
                    确认添加
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3 text-red-500">
                <AlertCircle size={24} />
              </div>
              <h3 className="font-bold text-lg text-slate-800">确认删除？</h3>
              <p className="text-sm text-slate-500 mt-1">
                该设备的记录将被永久移除，无法恢复。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
