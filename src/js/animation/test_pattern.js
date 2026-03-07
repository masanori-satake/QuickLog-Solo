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
            en: "A completely static pattern for bit-perfect visual verification. (Excluded from release)",
            ja: "ビット単位での完全一致を確認するための、完全に静止したパターンです。（製品版には含まれません）",
            de: "Ein vollständig statisches Muster für eine bitgenaue visuelle Verifizierung. (Nicht im Release enthalten)",
            es: "Un patrón completamente estático para una verificación visual perfecta. (Excluido del lanzamiento)",
            fr: "Un motif complètement statique pour une vérification visuelle parfaite bit à bit. (Exclu de la version finale)",
            pt: "Um padrão completamente estático para verificação visual perfecta bit a bit. (Excluído do lançamento)",
            ko: "비트 단위의 완전 일치를 확인하기 위한, 완전히 정지된 패턴입니다. (릴리스 제외)",
            zh: "用于位对位完全一致验证的完全静态模式。（不包含在发布版本中）"
        },
        author: "QuickLog-Solo",
        devOnly: true
    };

    config = { mode: 'sprite', usePseudoSpace: false };

    setup(width, height) {
        this.dots = [];
        const step = 6;
        for (let x = 0; x <= width; x += step) {
            for (let y = 0; y <= height; y += step) {
                // Draw a border and a large cross for unmistakable verification
                const isBorder = x === 0 || y === 0 || x >= width - step || y >= height - step;
                const isCross = Math.abs(x - y) < step || Math.abs(x - (width - y)) < step;
                if (isBorder || isCross) {
                    this.dots.push({ x, y, size: 3 });
                }
            }
        }
    }

    draw() {
        return this.dots;
    }
}
