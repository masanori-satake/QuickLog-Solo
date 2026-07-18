import { AnimationBase } from '../animation_base.js';
import { CELL_SIZE } from '../utils.js';

/**
 * Retro RPG Grid Transition
 * Portable monster breeding game-style battle transition effect.
 * 画面が最初に2回「全画面白黒反転」でピカッ、ピカッと激しく点滅（フラッシュ）した後、
 * 液晶画面外側から渦巻き（スパイラル）状に、濃い灰色のブロック（グリッド）が敷き詰められていきます。
 * 画面全体が埋め尽くされた瞬間、今度は一瞬で中心から外側に向けて開き（リセット）、ループが繰り返されます。
 */
export default class RpgGrid extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Retro RPG Grid Transition",
            ja: "戦闘突入グリッド",
            de: "Retro-RPG-Grid-Übergang",
            es: "Transición de cuadrícula RPG retro",
            fr: "Transition de grille RPG rétro",
            pt: "Transição de grade RPG retrô",
            ko: "레트로 RPG 그리드 트랜지션",
            zh: "复古RPG网格转换"
        },
        description: {
            en: "The screen flashes twice, then fills with dark spiral blocks from edges to center. Upon completion, it clears instantly.",
            ja: "携帯ゲームの戦闘開始時のように画面が2回点滅し、外側から四角いブロックが螺旋状に埋め尽くしたあと瞬時に晴れます。",
            de: "Der Bildschirm blinkt zweimal und füllt sich dann von den Rändern zur Mitte mit dunklen Spiralblöcken. Nach Fertigstellung wird er sofort gelöscht.",
            es: "La pantalla parpadea dos veces y luego se llena de bloques en espiral oscuros desde los bordes hacia el centro. Al completarse, se limpia instantáneamente.",
            fr: "L'écran clignote deux fois, puis se remplit de blocs de spirales sombres des bords vers le centre. Une fois terminé, il s'efface instantanément.",
            pt: "Tela pisca duas vezes e, em seguida, enche-se de blocos de espirais escuras das bordas para o centro. Ao terminar, limpa-se instantaneamente.",
            ko: "화면이 두 번 깜박인 다음, 가장자리부터 중앙까지 어두운 나선형 블록으로 채워집니다. 완료되면 즉시 지워집니다.",
            zh: "屏幕闪烁两次，然后从边缘到中心填充深色螺旋块。完成后，立即清除。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'matrix', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.spiralCoords = null;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.spiralCoords = null; // リサイズ時にキャッシュをクリア
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const cellSize = CELL_SIZE; // Perfect alignment with CELL_SIZE (6)
        const cols = Math.ceil(this.width / cellSize) || 12;
        const rows = Math.ceil(this.height / cellSize) || 8;

        // Initialize empty matrix
        const matrix = [];
        for (let r = 0; r < rows; r++) {
            matrix.push(new Array(cols).fill(0));
        }

        // 6-second total transition cycle
        const cycleMs = 6000;
        const t = elapsedMs % cycleMs;

        // State phase boundaries:
        // 0 - 600ms: Flash 2 times (0-150ms White, 150-300ms Default, 300-450ms White, 450-600ms Default)
        // 600 - 4500ms: Spiral filling sequence (3900ms)
        // 4500 - 5500ms: Full screen holding (1000ms)
        // 5500 - 6000ms: Instantly cleared / reset phase

        if (t < 600) {
            const isFlash = (t >= 0 && t < 150) || (t >= 300 && t < 450);
            if (isFlash) {
                // Fill full screen with brightness 3 (Strong lighting)
                for (let r = 0; r < rows; r++) {
                    matrix[r].fill(3);
                }
            }
        } else if (t >= 600 && t < 4500) {
            // Spiral fill sequence
            const fillProgress = (t - 600) / 3900; // 0.0 to 1.0
            const totalCells = rows * cols;
            const cellsToFill = Math.floor(fillProgress * totalCells);

            // キャッシュされた螺旋座標を使用（未生成の場合は生成）
            if (!this.spiralCoords) {
                this.spiralCoords = this.getSpiralCoordinates(rows, cols);
            }
            const spiralCoords = this.spiralCoords;

            for (let i = 0; i < Math.min(cellsToFill, spiralCoords.length); i++) {
                const { r, c } = spiralCoords[i];
                if (r >= 0 && r < rows && c >= 0 && c < cols) {
                    matrix[r][c] = 2; // Mid-brightness block
                }
            }
        } else if (t >= 4500 && t < 5500) {
            // Screen is completely filled
            for (let r = 0; r < rows; r++) {
                matrix[r].fill(2);
            }
        } else {
            // Reset / Cleared state (empty matrix)
            for (let r = 0; r < rows; r++) {
                matrix[r].fill(0);
            }
        }

        return matrix;
    }

    /**
     * Compute row-column coordinates in a spiral path from outside to inside
     */
    getSpiralCoordinates(rows, cols) {
        const coords = [];
        let top = 0;
        let bottom = rows - 1;
        let left = 0;
        let right = cols - 1;

        while (top <= bottom && left <= right) {
            // Travel Right
            for (let c = left; c <= right; c++) {
                coords.push({ r: top, c });
            }
            top++;

            // Travel Down
            for (let r = top; r <= bottom; r++) {
                coords.push({ r, c: right });
            }
            right--;

            // Travel Left
            if (top <= bottom) {
                for (let c = right; c >= left; c--) {
                    coords.push({ r: bottom, c });
                }
                bottom--;
            }

            // Travel Up
            if (left <= right) {
                for (let r = bottom; r >= top; r--) {
                    coords.push({ r, c: left });
                }
                left++;
            }
        }
        return coords;
    }
}
