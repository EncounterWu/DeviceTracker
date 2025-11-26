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
} from "lucide-react";

// --- Gemini API Configuration ---
// 在实际运行时，环境会自动提供 key，这里留空即可
const apiKey = "";

export default function App() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("manual"); // 'manual' or 'ai'

  // 表单状态：增加了 image 字段
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    date: "",
    type: "phone",
    image: null,
  });

  // AI 状态
  const [smartInput, setSmartInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); // AI 模式下的临时图片
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 引用文件输入框
  const fileInputRef = useRef(null); // 用于 AI 模式
  const manualFileInputRef = useRef(null); // 用于手动模式

  // 删除确认状态
  const [itemToDelete, setItemToDelete] = useState(null);

  // 初始化加载数据
  useEffect(() => {
    const savedItems = localStorage.getItem("my_devices");
    if (savedItems) {
      setItems(JSON.parse(savedItems));
    }
  }, []);

  // 监听 items 变化并保存
  useEffect(() => {
    localStorage.setItem("my_devices", JSON.stringify(items));
  }, [items]);

  // 核心逻辑：计算天数和日均成本
  const calculateStats = (price, dateStr) => {
    const purchaseDate = new Date(dateStr);
    const today = new Date();
    const timeDiff = Math.abs(today - purchaseDate);
    const daysOwned = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const validDays = daysOwned < 1 ? 1 : daysOwned;
    const dailyCost = (parseFloat(price) / validDays).toFixed(2);
    return { days: validDays, dailyCost };
  };

  // --- Gemini API Call Helper ---
  const callGemini = async (prompt, imageBase64 = null) => {
    try {
      const parts = [{ text: prompt }];
      if (imageBase64) {
        const base64Data = imageBase64.split(",")[1];
        const mimeType = imageBase64.split(";")[0].split(":")[1];
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: parts }],
          }),
        }
      );

      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  };

  // 处理手动模式图片上传
  const handleManualImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 简单限制图片大小，防止 localStorage 爆满 (2MB)
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

  // 处理 AI 模式图片上传
  const handleSmartImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Feature 1: AI 智能录入 ---
  const handleSmartAdd = async () => {
    if (!smartInput.trim() && !selectedImage) {
      setErrorMsg("请输入文字描述或上传订单截图。");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg("");

    const prompt = `
      You are an assistant that extracts product details from text or order screenshots (images).
      
      User Input Text: "${smartInput}"
      Current Date: "${new Date().toISOString().split("T")[0]}"
      
      Task:
      Extract device information into a JSON object. 
      If an image is provided, prioritize information visible in the image.
      
      Requirements:
      1. Return ONLY the JSON object.
      2. Fields: "name", "price" (number), "date" (YYYY-MM-DD), "type" (one of: 'phone', 'laptop', 'watch', 'console', 'camera', 'audio', 'home', 'other').
    `;

    try {
      const resultText = await callGemini(prompt, selectedImage);
      const jsonStr = resultText.replace(/```json|```/g, "").trim();
      const result = JSON.parse(jsonStr);

      setNewItem({
        name: result.name || "",
        price: result.price || "",
        date: result.date || new Date().toISOString().split("T")[0],
        type: result.type || "other",
        image: selectedImage, // ✨ 关键修改：将识别用的图片直接继承给新设备
      });
      setModalMode("manual");
      setSmartInput("");
      setSelectedImage(null);
    } catch (e) {
      console.error(e);
      setErrorMsg("AI 识别失败，请确保截图清晰或重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Feature 2: AI 资产分析 ---
  const generateReport = async () => {
    if (items.length === 0) return;
    setIsGeneratingReport(true);
    const enrichedItems = items.map((item) => ({
      ...item,
      stats: calculateStats(item.price, item.date),
    }));

    const prompt = `
      Act as a witty financial tech consultant. Analyze this user's device list and generate a short, fun report in CHINESE.
      Data: ${JSON.stringify(enrichedItems)}
      Output format (HTML):
      <div class="space-y-2">
        <p><strong>🏆 最值回票价奖:</strong> [Device Name] (Daily cost: [Cost]) - [One sentence why]</p>
        <p><strong>💸 最大的坑:</strong> [Device Name] (Daily cost: [Cost]) - [One sentence why]</p>
        <p><strong>📊 消费画像:</strong> [2-3 sentences analyzing their spending habits. Be humorous!]</p>
      </div>
    `;

    try {
      const text = await callGemini(prompt);
      const cleanHtml = text.replace(/```html|```/g, "").trim();
      setAiReport(cleanHtml);
    } catch (e) {
      setErrorMsg("生成报告失败，请稍后再试。");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // 添加新设备
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price || !newItem.date) return;

    const itemToAdd = {
      id: Date.now(),
      ...newItem,
    };

    setItems([itemToAdd, ...items]);
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
            {isGeneratingReport ? "分析中..." : "AI 分析"}
          </button>
        )}
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* --- 概览卡片 --- */}
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg mb-6 transition-all duration-500">
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
          <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold">
              <Wand2 size={18} />
              <span>AI 资产分析日报</span>
            </div>
            <div
              className="text-sm text-slate-700 leading-relaxed report-content"
              dangerouslySetInnerHTML={{ __html: aiReport }}
            />
            <button
              onClick={() => setAiReport(null)}
              className="mt-3 text-xs text-slate-400 hover:text-slate-600 underline"
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
                      {/* 图标或图片容器 */}
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

      {/* --- FAB --- */}
      <button
        onClick={() => {
          setShowModal(true);
          setModalMode("manual");
          setErrorMsg("");
          setSelectedImage(null);
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

            {/* Tab Switcher */}
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
                  {/* ... AI 模式 UI 保持不变 ... */}
                  <div className="bg-purple-50 p-4 rounded-xl text-xs text-purple-700 mb-2">
                    <p className="font-bold mb-1">💡 全能识别模式：</p>
                    <p className="opacity-80">
                      上传电商订单截图，或直接输入文字描述，AI
                      将自动提取信息。截图将自动作为设备图片保存。
                    </p>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      selectedImage
                        ? "border-purple-300 bg-purple-50"
                        : "border-slate-300 hover:border-purple-400 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleSmartImageSelect}
                    />

                    {selectedImage ? (
                      <div className="relative w-full">
                        <img
                          src={selectedImage}
                          alt="Selected"
                          className="max-h-40 rounded-lg mx-auto object-contain shadow-sm"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400">
                        <ImageIcon
                          size={32}
                          className="mx-auto mb-2 opacity-50"
                        />
                        <span className="text-sm font-medium">
                          点击上传订单截图
                        </span>
                      </div>
                    )}
                  </div>

                  <textarea
                    placeholder="备注 (可选)，例如：这是双十一买的..."
                    className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px] resize-none text-slate-700 text-sm"
                    value={smartInput}
                    onChange={(e) => setSmartInput(e.target.value)}
                  />

                  {errorMsg && (
                    <p className="text-red-500 text-xs">{errorMsg}</p>
                  )}

                  <button
                    onClick={handleSmartAdd}
                    disabled={
                      isAnalyzing || (!smartInput.trim() && !selectedImage)
                    }
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        AI 识别中...
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
                  {/* 手动模式下的图片上传区 */}
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

      {/* --- 删除确认弹窗 --- */}
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
