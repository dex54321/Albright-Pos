"use client";
export default function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-md rounded-xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
