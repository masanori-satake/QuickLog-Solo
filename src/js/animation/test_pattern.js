import { AnimationBase } from '../animation_base.js';

export default class TestPattern extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Verification Pattern",
            ja: "動作確認用パターン",
            de: "Verifizierungsmuster",
            es: "Patrón de verificación",
            fr: "Motif de vérification",
            pt: "Padrão de verificação",
            ko: "동작 확인용 패턴",
            zh: "验证模式"
        },
        description: {
            en: "A continuous, predictable pattern for visual verification. (Excluded from release)",
            ja: "目視確認用の、連続で予測可能なパターンです。（製品版には含まれません）",
            de: "Ein kontinuierliches, vorhersehbares Muster zur visuellen Überprüfung. (Nicht im Release enthalten)",
            es: "Un patrón continuo y predecible para la verificación visual. (Excluido del lanzamiento)",
            fr: "Un motif continu et prévisible pour la vérification visuelle. (Exclu de la version finale)",
            pt: "Um padrão contínuo e previsível para verificação visual. (Excluído do lançamento)",
            ko: "시각적 확인을 위한 연속적이고 예측 가능한 패턴입니다. (릴리스 제외)",
            zh: "用于视觉验证的连续且可预测的模式。（不包含在发布版本中）"
        },
        author: "QuickLog-Solo",
        devOnly: true
    };

    config = { mode: 'canvas', usePseudoSpace: true };

    draw(ctx, { width, height, elapsedMs }) {
        const cellSize = 48; // Large enough for human recognition
        const speed = 0.03;
        const offset = (elapsedMs * speed) % cellSize;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;

        // Vertical lines
        for (let x = offset; x < width; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = offset; y < height; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Add a moving block for dynamic feel
        const blockSize = 24;
        const blockX = (elapsedMs * 0.1) % (width + blockSize) - blockSize;
        const blockY = (elapsedMs * 0.05) % (height + blockSize) - blockSize;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(blockX, blockY, blockSize, blockSize);
    }
}
