import { QRCodeSVG } from "qrcode.react";
import { ExportData } from "./types";

interface Props {
  data: ExportData;
}

// A4 dimensions: 210mm × 297mm at 96 DPI ≈ 794 × 1123 px
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

// Color pairs: [leftColor, rightColor] - darker when dominant, lighter when not
const pdfAxisColors: Record<string, { left: [string, string]; right: [string, string] }> = {
  // Control = Slate/Steel Blue, Flow = Teal/Cyan
  control_flow: {
    left: ['#475569', '#94a3b8'],
    right: ['#0d9488', '#5eead4'],
  },
  // Accuracy = Indigo/Deep Blue, Expressiveness = Amber/Orange
  accuracy_expressiveness: {
    left: ['#4338ca', '#a5b4fc'],
    right: ['#d97706', '#fcd34d'],
  },
  // Security = Emerald/Green, Risk = Rose/Red-Pink
  security_risk: {
    left: ['#059669', '#6ee7b7'],
    right: ['#e11d48', '#fda4af'],
  },
};

function PDFAxisBar({ 
  leftLabel, 
  rightLabel, 
  normalized,
  label,
  axisKey
}: { 
  leftLabel: string; 
  rightLabel: string; 
  normalized: number;
  label: string;
  axisKey: string;
}) {
  // Clamp position between 8% and 92% for visual buffer
  const clampedPosition = Math.max(8, Math.min(92, normalized));
  const colors = pdfAxisColors[axisKey] || pdfAxisColors.control_flow;
  
  // Determine which side is dominant (darker)
  const leaningLeft = normalized < 50;
  const leftColor = leaningLeft ? colors.left[0] : colors.left[1];
  const rightColor = leaningLeft ? colors.right[1] : colors.right[0];
  
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: leftColor, fontWeight: leaningLeft ? 600 : 400 }}>{leftLabel}</span>
        <span style={{ color: rightColor, fontWeight: !leaningLeft ? 600 : 400 }}>{rightLabel}</span>
      </div>
      <div style={{ position: 'relative', height: 12, borderRadius: 9999, overflow: 'hidden', display: 'flex' }}>
        {/* Left side */}
        <div style={{ width: `${clampedPosition}%`, backgroundColor: leftColor, borderTopLeftRadius: 9999, borderBottomLeftRadius: 9999 }} />
        {/* Right side */}
        <div style={{ width: `${100 - clampedPosition}%`, backgroundColor: rightColor, borderTopRightRadius: 9999, borderBottomRightRadius: 9999 }} />
        {/* Position marker */}
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            transform: 'translate(-50%, -50%)',
            left: `${clampedPosition}%`,
            width: 16, 
            height: 16, 
            backgroundColor: 'white', 
            borderRadius: 9999, 
            border: '2px solid rgba(0,0,0,0.15)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            zIndex: 10
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{label}</span>
      </div>
    </div>
  );
}

export function PDFPage1({ data }: Props) {
  return (
    <div 
      style={{ 
        width: PAGE_WIDTH, 
        height: PAGE_HEIGHT,
        backgroundColor: 'white',
        color: '#111827',
        padding: 48,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: 32, marginBottom: 32 }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 16 }}>Learning Personality Assessment</p>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{data.archetype.emoji}</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{data.archetype.name}</h1>
        <p style={{ fontSize: 16, color: '#6366f1' }}>{data.archetype.signature}</p>
      </div>

      {/* 3-Axis Profile */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 4, height: 24, backgroundColor: '#6366f1', borderRadius: 4 }}></span>
          Your 3-Axis Profile
        </h2>
        <div style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 24 }}>
          <PDFAxisBar 
            leftLabel="Control" 
            rightLabel="Flow" 
            normalized={data.axes.control_flow.normalized}
            label={data.axes.control_flow.label}
            axisKey="control_flow"
          />
          <PDFAxisBar 
            leftLabel="Accuracy" 
            rightLabel="Expressiveness" 
            normalized={data.axes.accuracy_expressiveness.normalized}
            label={data.axes.accuracy_expressiveness.label}
            axisKey="accuracy_expressiveness"
          />
          <PDFAxisBar 
            leftLabel="Security" 
            rightLabel="Risk" 
            normalized={data.axes.security_risk.normalized}
            label={data.axes.security_risk.label}
            axisKey="security_risk"
          />
        </div>
      </div>

      {/* Badges */}
      {data.badges.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 4, height: 24, backgroundColor: '#f59e0b', borderRadius: 4 }}></span>
            Badges Earned
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {data.badges.map((badge) => (
              <div 
                key={badge.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 12, 
                  padding: 16, 
                  backgroundColor: '#fffbeb', 
                  borderRadius: 12, 
                  border: '1px solid #fef3c7' 
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{badge.icon}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{badge.name}</p>
                  <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* About You */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 4, height: 24, backgroundColor: '#a855f7', borderRadius: 4 }}></span>
          About You
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.archetype.description.split('. ').reduce((acc: string[][], sentence, i, arr) => {
            const lastGroup = acc[acc.length - 1];
            if (!lastGroup || lastGroup.length >= 2) {
              acc.push([sentence + (i < arr.length - 1 ? '.' : '')]);
            } else {
              lastGroup.push(sentence + (i < arr.length - 1 ? '.' : ''));
            }
            return acc;
          }, []).map((sentences, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#374151', margin: 0 }}>
              {sentences.join(' ')}
            </p>
          ))}
        </div>
      </div>

      {/* Page number */}
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#9ca3af' }}>
        Page 1 of 3
      </div>
    </div>
  );
}

export function PDFPage2({ data }: Props) {
  return (
    <div 
      style={{ 
        width: PAGE_WIDTH, 
        height: PAGE_HEIGHT,
        backgroundColor: 'white',
        color: '#111827',
        padding: 48,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 24, marginBottom: 32 }}>
        <span style={{ fontSize: 40 }}>{data.archetype.emoji}</span>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{data.archetype.name}</h1>
          <p style={{ fontSize: 13, color: '#6b7280' }}>{data.archetype.signature}</p>
        </div>
      </div>

      {/* Insights Grid */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 24, backgroundColor: '#6366f1', borderRadius: 4 }}></span>
        Your Learning Profile Insights
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {/* Strengths */}
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: '#f0fdf4', border: '1px solid #dcfce7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <h3 style={{ fontWeight: 600, color: '#166534', fontSize: 14 }}>Your Strengths</h3>
          </div>
          <p style={{ fontSize: 13, color: '#15803d', lineHeight: 1.6 }}>{data.archetype.strengths}</p>
        </div>

        {/* Bottleneck */}
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <h3 style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>Hidden Bottleneck</h3>
          </div>
          <p style={{ fontSize: 13, color: '#a16207', lineHeight: 1.6 }}>{data.archetype.bottleneck}</p>
        </div>

        {/* Fastest Path */}
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: '#eff6ff', border: '1px solid #dbeafe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🚀</span>
            <h3 style={{ fontWeight: 600, color: '#1e40af', fontSize: 14 }}>Fastest Path</h3>
          </div>
          <p style={{ fontSize: 13, color: '#1d4ed8', lineHeight: 1.6 }}>{data.archetype.fastestPath}</p>
        </div>

        {/* Danger Path */}
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <h3 style={{ fontWeight: 600, color: '#991b1b', fontSize: 14 }}>Danger Path</h3>
          </div>
          <p style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.6 }}>{data.archetype.dangerPath}</p>
        </div>
      </div>

      {/* Encouragement */}
      {data.archetype.encouragement && (
        <div style={{ padding: 20, borderRadius: 12, backgroundColor: '#eef2ff', border: '1px solid #e0e7ff', marginBottom: 32 }}>
          <p style={{ fontSize: 13, color: '#4338ca', lineHeight: 1.6, fontStyle: 'italic' }}>
            💡 {data.archetype.encouragement}
          </p>
        </div>
      )}

      {/* Keep Doing */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 24, backgroundColor: '#22c55e', borderRadius: 4 }}></span>
        Keep Doing
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
        {data.archetype.recommendations.keep.map((item, i) => (
          <span 
            key={i}
            style={{ 
              padding: '6px 12px', 
              borderRadius: 9999, 
              backgroundColor: '#dcfce7', 
              color: '#166534', 
              fontSize: 13, 
              fontWeight: 500 
            }}
          >
            ✓ {item}
          </span>
        ))}
      </div>

      {/* Page number */}
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#9ca3af' }}>
        Page 2 of 3
      </div>
    </div>
  );
}

export function PDFPage3({ data }: Props) {
  return (
    <div 
      style={{ 
        width: PAGE_WIDTH, 
        height: PAGE_HEIGHT,
        backgroundColor: 'white',
        color: '#111827',
        padding: 48,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 24, marginBottom: 32 }}>
        <span style={{ fontSize: 40 }}>{data.archetype.emoji}</span>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{data.archetype.name}</h1>
          <p style={{ fontSize: 13, color: '#6b7280' }}>Personalized Recommendations</p>
        </div>
      </div>

      {/* Add Next */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 24, backgroundColor: '#3b82f6', borderRadius: 4 }}></span>
        Add Next
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {data.archetype.recommendations.add.map((item, i) => (
          <div 
            key={i}
            style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 12, 
              padding: 16, 
              backgroundColor: '#eff6ff', 
              borderRadius: 12, 
              border: '1px solid #dbeafe' 
            }}
          >
            <div style={{ 
              flexShrink: 0, 
              width: 28, 
              height: 28, 
              borderRadius: 9999, 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 700, 
              fontSize: 13 
            }}>
              {i + 1}
            </div>
            <p style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.6, flex: 1, paddingTop: 4 }}>{item}</p>
          </div>
        ))}
      </div>

      {/* Watch Out */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 24, backgroundColor: '#f59e0b', borderRadius: 4 }}></span>
        Watch Out For
      </h2>
      <div style={{ padding: 20, borderRadius: 12, backgroundColor: '#fffbeb', border: '1px solid #fef3c7', marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <p style={{ fontSize: 13, color: '#a16207', lineHeight: 1.6 }}>
            {data.archetype.recommendations.watchOut}
          </p>
        </div>
      </div>

      {/* CTA Footer */}
      <div style={{ 
        position: 'absolute', 
        bottom: 64, 
        left: 48, 
        right: 48,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 24, 
        borderRadius: 16, 
        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
        color: 'white'
      }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Continue Your Journey</h3>
          <p style={{ fontSize: 13, opacity: 0.9 }}>Take the full fluency assessment to get personalized training.</p>
          <p style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>{data.shareUrl}</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: 8, borderRadius: 8 }}>
          <QRCodeSVG value={data.shareUrl} size={70} />
        </div>
      </div>

      {/* Page number */}
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#9ca3af' }}>
        Page 3 of 3
      </div>
    </div>
  );
}
