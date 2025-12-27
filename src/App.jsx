import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

const SAMPLE_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

function sanitizeKey(name) {
  return name.replace(/[^a-z0-9_-]/gi, "_");
}

export default function App() {
  const [files, setFiles] = useState([]); // { key, name, fileName, scores: number[] }
  const [errors, setErrors] = useState([]);

  function handleFileInput(ev) {
    const fileList = Array.from(ev.target.files || []);
    readFiles(fileList);
    ev.target.value = null;
  }

  function readFiles(fileList) {
    const readers = fileList.map((f) =>
      new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, text: r.result });
        r.onerror = () => resolve({ name: f.name, text: null, error: "Failed to read file" });
        r.readAsText(f);
      })
    );

    Promise.all(readers).then((results) => {
      const nextFiles = [...files];
      const nextErrors = [];

      results.forEach((res) => {
        if (!res.text) {
          nextErrors.push(`${res.name}: could not read file`);
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(res.text);
        } catch (e) {
          nextErrors.push(`${res.name}: invalid JSON (${e.message})`);
          return;
        }

        const root = Array.isArray(parsed) ? parsed[0] ?? parsed : parsed;
        if (!root || !Array.isArray(root.rounds)) {
          nextErrors.push(`${res.name}: JSON doesn't contain a top-level object with a 'rounds' array`);
          return;
        }

        const rounds = root.rounds;
        const invalidRound = rounds.find((r) => typeof r.score !== "number");
        if (invalidRound) {
          nextErrors.push(`${res.name}: one or more rounds missing numeric 'score'`);
          return;
        }

        const sorted = [...rounds].sort((a, b) => b.score - a.score);
        const scores = sorted.map((r) => r.score);

        const name = root.name || res.name;
        const key = sanitizeKey(name + "__" + res.name);

        const existingIndex = nextFiles.findIndex((f) => f.key === key);
        const fileObj = { key, name, fileName: res.name, scores };
        if (existingIndex >= 0) nextFiles[existingIndex] = fileObj;
        else nextFiles.push(fileObj);
      });

      setFiles(nextFiles);
      setErrors(nextErrors);
    });
  }

  function removeFile(key) {
    setFiles((s) => s.filter((f) => f.key !== key));
  }

  const filesWithStats = files.map((f) => {
    const n = f.scores.length;
    const sum = f.scores.reduce((s, x) => s + x, 0);
    const avg = n ? sum / n : null;
    return { ...f, avg };
  });

  const maxLen = filesWithStats.reduce((m, f) => Math.max(m, f.scores.length), 0);
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const point = { round: i + 1 };
    filesWithStats.forEach((f) => {
      point[f.key] = f.scores[i] == null ? null : f.scores[i];
    });
    return point;
  });

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              <a href="https://hiddengems.gymnasiumsteglitz.de">Hidden Gems</a> JSON compare
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Use the runner's <code>--write-profile-json</code> flag and upload the output files.
              <br/>The graph shows the score of each round and the average score of all rounds per file.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center px-4 py-2 bg-white border rounded shadow-sm cursor-pointer hover:bg-slate-50">
              <input id="json-upload" type="file" accept="application/json" multiple onChange={handleFileInput} className="hidden" />
              <svg className="w-4 h-4 mr-2 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 7l4-4 4 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-sm text-slate-700">Upload JSON</span>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap gap-3">
            {files.map((f, idx) => (
              <div key={f.key} className="flex items-center gap-3 bg-white border rounded px-3 py-2 shadow-sm">
                <div style={{ width: 12, height: 12, background: SAMPLE_COLORS[idx % SAMPLE_COLORS.length], borderRadius: 4 }} />
                <div className="text-sm font-medium">{f.fileName}</div>
                <div className="text-xs text-slate-500">({f.scores.length} rounds)</div>
                <button onClick={() => removeFile(f.key)} className="ml-3 text-xs text-rose-600 hover:underline">Remove</button>
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded">
              <strong>Errors</strong>
              <ul className="list-disc list-inside text-sm mt-1">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white border rounded shadow p-4">
          {files.length === 0 ? (
            <div className="text-center text-slate-500 py-12">Upload JSON files to see the chart.</div>
          ) : (
            <div style={{ width: "100%", height: 480 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 20, right: 70, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="round" tickFormatter={(v) => `#${v}`} label={{ value: "Round (ranked: #1 = highest score)", position: "insideBottom", offset: -8 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  {filesWithStats.map((f, idx) => (
                    <Line key={f.key} type="monotone" dataKey={f.key} name={f.fileName} stroke={SAMPLE_COLORS[idx % SAMPLE_COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />
                  ))}

                  {filesWithStats.map((f, idx) => (
                    f.avg != null ? (
                      <ReferenceLine key={f.key + "_avg"} y={f.avg} stroke={SAMPLE_COLORS[idx % SAMPLE_COLORS.length]} strokeDasharray="3 2" strokeWidth={1} label={{ position: "right", value: `${f.avg}` }} />
                    ) : null
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
