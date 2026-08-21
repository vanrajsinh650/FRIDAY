import { ScreenTree } from '../native/types';

export class PromptFormatter {
  static formatScreenForLLM(tree: ScreenTree): string {
    const lines: string[] = [
      `Active Package: ${tree.activePackage}`,
      `Screen Resolution: ${tree.screenWidth}x${tree.screenHeight}`,
      `Visible Interactive Elements:`,
    ];

    for (const node of tree.nodes.slice(0, 25)) {
      const desc = node.contentDescription ? ` desc="${node.contentDescription}"` : '';
      const text = node.text ? ` text="${node.text}"` : '';
      const clickable = node.isClickable ? ' [clickable]' : '';
      const editable = node.isEditable ? ' [editable]' : '';
      lines.push(`- ID: ${node.id} (${node.className})${text}${desc}${clickable}${editable} bounds=[${node.bounds.left},${node.bounds.top},${node.bounds.right},${node.bounds.bottom}]`);
    }

    return lines.join('\n');
  }
}
