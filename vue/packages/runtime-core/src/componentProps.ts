import { reactive } from '@vue/reactivity';
import { hasOwn } from '@vue/share';

/**
 *
 * @param instance 组件实例
 * @param rawProps 原始组件接受的真实Props
 */
export function initProps(instance, rawProps) {
  const props = {};
  const attrs = {};

  // 组件内部显式接受的props
  const options = instance.propsOptions || {};

  if (rawProps) {
    // 别忘记了 for in 可以遍历到原型上的可扩展属性
    // 而Object.keys 仅仅支持自身属性
    for (let key in rawProps) {
      const value = rawProps[key];
      if (hasOwn(options, key)) {
        // 为Props
        props[key] = value;
      } else {
        // 为 attrs
        attrs[key] = value;
      }
    }
  }

  // props是响应式的 但是注意是浅的 shallowReactive
  // 这里自己实现简单点就使用 reactive
  instance.props = reactive(props);
  instance.attrs = attrs;
}
