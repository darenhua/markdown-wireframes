// components/registry.tsx
import type { ComponentRegistry } from '@json-render/react';

export const registry: ComponentRegistry = {
    Card: ({ element, children }) => (
        <div className="p-4 border rounded-lg">
            <h2 className="font-bold">{element.props.title}</h2>
            {element.props.description && (
                <p className="text-gray-600">{element.props.description}</p>
            )}
            {children}
        </div>
    ),
    Button: ({ element, onAction }) => (
        <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => onAction?.(element.props.action)}
        >
            {element.props.label}
        </button>
    ),
    Text: ({ element }) => (
        <p>{element.props.content}</p>
    ),
};