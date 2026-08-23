import { extractMessageIntent, Planner } from '../src/agent/planner';
import { FridayAgent } from '../src/agent/agent';
import { useAgentStore } from '../src/state/agentStore';
import { AccessibilityModule } from '../src/native/AccessibilityModule';
import { ScreenTree, UINode } from '../src/native/types';

// --- helpers ----------------------------------------------------------------

function node(partial: Partial<UINode> & { id: string }): UINode {
  return {
    className: 'android.view.ViewGroup',
    isClickable: true,
    isEditable: false,
    isScrollable: false,
    isVisible: true,
    packageName: 'com.whatsapp',
    bounds: { left: 40, top: 300, right: 1040, bottom: 480, centerX: 540, centerY: 390, width: 1000, height: 180 },
    ...partial,
  } as UINode;
}

function waTree(nodes: UINode[]): ScreenTree {
  return { activePackage: 'com.whatsapp', nodes, timestamp: 1, screenWidth: 1080, screenHeight: 2400 };
}

function messagingSnapshot(rawGoal: string, screenTree: ScreenTree, actionHistory: Array<{ toolName: string }>): any {
  return {
    activeGoal: rawGoal,
    goalType: 'MESSAGING',
    screenTree,
    memoryFacts: [],
    recentActionHistory: [],
    conversationHistory: [],
    activeTask: { rawGoal, goalType: 'MESSAGING', actionHistory },
  };
}

// A stub provider so constructing the planner never touches the network. The
// messaging branches under test all return before any provider call.
const stubProvider = {
  name: 'stub',
  generateText: async () => '',
  generateToolCall: async () => ({ toolName: 'none', parameters: {} }),
} as any;

// --- parser -----------------------------------------------------------------

describe('extractMessageIntent — who + what', () => {
  test('English "send <msg> to <contact>" strips a trailing app mention', () => {
    const { contact, message } = extractMessageIntent('send hi to Vanrajsinh on whatsapp');
    expect(contact.toLowerCase()).toBe('vanrajsinh');
    expect(message).toBe('hi');
  });

  test('multi-word message keeps its wording and casing', () => {
    const { contact, message } = extractMessageIntent('send Good Morning to Mom');
    expect(contact.toLowerCase()).toBe('mom');
    expect(message).toBe('Good Morning');
  });

  test('a quoted message is taken verbatim, contact from "to"', () => {
    const { contact, message } = extractMessageIntent(`send "on my way" to dad`);
    expect(contact.toLowerCase()).toBe('dad');
    expect(message).toBe('on my way');
  });

  test('send message to contact on whatsapp format', () => {
    const { contact, message } = extractMessageIntent('send good night to mummy on whatsapp');
    expect(contact.toLowerCase()).toBe('mummy');
    expect(message).toBe('good night');
  });

  test('"message <contact> saying <msg>" form', () => {
    const { contact, message } = extractMessageIntent('message dad saying I am late');
    expect(contact.toLowerCase()).toBe('dad');
    expect(message).toBe('I am late');
  });

  test('leading "open whatsapp and ..." wrapper is peeled off', () => {
    const { contact, message } = extractMessageIntent('open whatsapp and send hello to Ravi');
    expect(contact.toLowerCase()).toBe('ravi');
    expect(message).toBe('hello');
  });
});

// --- planner branch behavior ------------------------------------------------

describe('Planner — WhatsApp send flow', () => {
  test('at the chat list, searches for the named contact', async () => {
    const planner = new Planner(stubProvider);
    const snapshot = messagingSnapshot(
      'send hi to vanrajsinh on whatsapp',
      waTree([node({ id: 'wa_search_edit', className: 'android.widget.EditText', contentDescription: 'Search name or number', text: '', isEditable: true })]),
      [{ toolName: 'launch_app' }]
    );
    const action = await planner.planNextAction(snapshot);
    expect(action.toolName).toBe('type_text');
    expect(String(action.parameters.text).toLowerCase()).toContain('vanrajsinh');
  });

  test('once the contact row appears, opens that chat', async () => {
    const planner = new Planner(stubProvider);
    const snapshot = messagingSnapshot(
      'send hi to vanrajsinh on whatsapp',
      waTree([
        node({ id: 'wa_search_edit', className: 'android.widget.EditText', contentDescription: 'Search name or number', text: 'vanrajsinh', isEditable: true }),
        node({ id: 'wa_contact_result', text: 'vanrajsinh', contentDescription: 'Contact' }),
      ]),
      [{ toolName: 'launch_app' }, { toolName: 'type_text' }]
    );
    const action = await planner.planNextAction(snapshot);
    expect(action.toolName).toBe('click_text');
    expect(String(action.parameters.text).toLowerCase()).toContain('vanrajsinh');
  });

  test('inside the chat, types the message body before sending', async () => {
    const planner = new Planner(stubProvider);
    const snapshot = messagingSnapshot(
      'send hi to vanrajsinh on whatsapp',
      waTree([node({ id: 'wa_composer', className: 'android.widget.EditText', contentDescription: 'Message', text: '', isEditable: true })]),
      [{ toolName: 'launch_app' }, { toolName: 'type_text' }, { toolName: 'click_text' }]
    );
    const action = await planner.planNextAction(snapshot);
    expect(action.toolName).toBe('type_text');
    expect(String(action.parameters.text)).toBe('hi');
  });

  test('after Send, verifies rather than self-declaring success (honesty gate)', async () => {
    const planner = new Planner(stubProvider);
    const snapshot = messagingSnapshot(
      'send hi to vanrajsinh on whatsapp',
      waTree([
        node({ id: 'wa_composer', className: 'android.widget.EditText', contentDescription: 'Message', text: '', isEditable: true }),
        node({ id: 'wa_msg_1', className: 'android.widget.TextView', text: 'hi', contentDescription: 'Delivered', isClickable: false }),
      ]),
      [{ toolName: 'launch_app' }, { toolName: 'type_text' }, { toolName: 'click_text' }, { toolName: 'type_text' }, { toolName: 'click_send_button' }]
    );
    const action = await planner.planNextAction(snapshot);
    expect(action.toolName).toBe('verify_message_sent');
    expect(String(action.parameters.expectedSnippet)).toBe('hi');
  });
});

// --- full offline e2e -------------------------------------------------------

describe('FridayAgent — WhatsApp send benchmark', () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
    AccessibilityModule.resetMockTree();
    jest.spyOn(AccessibilityModule, 'isServiceEnabled').mockResolvedValue(true);
  });

  test('searches, opens the chat, types, sends, and verifies delivery', async () => {
    const agent = new FridayAgent();
    const result = await agent.executeGoal('Send hi to Vanrajsinh on WhatsApp');

    expect(result.toLowerCase()).toContain('boss');
    expect(useAgentStore.getState().state).toBe('SUCCESS');

    const stepTools = useAgentStore.getState().steps.map((s) => s.toolName);
    expect(stepTools).toContain('launch_app');
    expect(stepTools).toContain('type_text');
    expect(stepTools).toContain('click_text');
    expect(stepTools).toContain('click_send_button');
    expect(stepTools).toContain('verify_message_sent');
  });
});
