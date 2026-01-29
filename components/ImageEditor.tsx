import React, { useState } from 'react';
import { editDocumentImage } from '../services/geminiService';
import { Loader2, Wand2, Upload, Save, X } from 'lucide-react';

interface ImageEditorProps {
  initialImage: string | null;
  onSave: (newImage: string) => void;
  onClose: () => void;
  docId: string;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ initialImage, onSave, onClose, docId }) => {
  const [currentImage, setCurrentImage] = useState<string | null>(initialImage);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiEdit = async () => {
    if (!currentImage || !prompt) return;
    
    setLoading(true);
    setError(null);
    try {
      const newImage = await editDocumentImage(currentImage, prompt);
      setCurrentImage(newImage);
      setPrompt(''); // Clear prompt after success
    } catch (err) {
      setError("Falha ao processar imagem com IA. Verifique sua chave API ou tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-orange-500" />
            Editor IA - Documento {docId}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6">
          
          {/* Image Area */}
          <div className="flex-1 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center relative min-h-[300px]">
            {currentImage ? (
              <img src={currentImage} alt="Documento" className="max-w-full max-h-[500px] object-contain" />
            ) : (
              <div className="text-center p-6 text-gray-500">
                <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma imagem carregada</p>
                <label className="mt-4 inline-block px-4 py-2 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-50 text-sm font-medium text-gray-700">
                  Selecionar Arquivo
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </div>
            )}
            
            {loading && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-2" />
                <p className="text-sm font-medium text-gray-600">A IA está processando...</p>
              </div>
            )}
          </div>

          {/* Controls Area */}
          <div className="w-full md:w-80 flex flex-col gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-2">
              <strong>Dica Gemini:</strong> Use comandos como "Remover fundo escuro", "Aumentar contraste do texto", "Converter para preto e branco".
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompt de Edição (IA)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Melhorar nitidez..."
                  className="flex-1 border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiEdit()}
                />
                <button
                  onClick={handleAiEdit}
                  disabled={loading || !currentImage || !prompt}
                  className="bg-purple-600 text-white p-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Executar IA"
                >
                  <Wand2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

            <div className="mt-auto pt-4 border-t flex flex-col gap-2">
              <label className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 text-sm font-medium">
                <Upload className="w-4 h-4" />
                Carregar Nova Imagem
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
              
              <button
                onClick={() => currentImage && onSave(currentImage)}
                disabled={!currentImage}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-bold shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Salvar e Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};