import { isString, ShapeFlags } from '@vue/share';
import { createVNode, isSameVNodeType, Text } from './vnode';

export function createRenderer(renderOptions) {
  const {
    createElement: hostCreateElement,
    createText: hostCreateText,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText,
    setText: hostSetText,
    querySelector: hostQuerySelector,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProps: hostPatchProps,
  } = renderOptions;

  /**
   * 格式化儿子节点 子节点Vnode有可能是字符串
   * 比如： h('div',{},['123','456'])
   */
  function normalize(vnode) {
    if (isString(vnode)) {
      return createVNode(Text, null, vnode);
    }
    return vnode;
  }

  /**
   * 卸载逻辑
   */
  function unmount(vnode) {
    // 页面卸载对应HTML节点
    hostRemove(vnode.el);
    // 清空引用
    vnode.el = null;
  }

  function mountChildren(el, children) {
    children.forEach((vnode, index) => {
      // vnode有可能仅仅只是一个字符串
      let childVNode = (children[index] = normalize(vnode));
      patch(null, childVNode, el);
    });
  }

  function unMountChildren(children) {
    for (let i = 0; i < children.length; i++) {
      // 移除之前所有儿子节点
      unmount(children[i]);
    }
  }

  /**
   * 更新元素属性
   */
  function patchProps(oldProps, newProps, container) {
    // 更新原本节点中newProps中的属性
    for (let newKey in newProps) {
      hostPatchProps(container, newKey, oldProps[newKey], newProps[newKey]);
    }
    // 同时移除已经不存在的属性
    for (let oldKey in oldProps) {
      if (newProps[oldKey] === null) {
        hostPatchProps(container, oldKey, oldProps[oldKey], undefined);
      }
    }
  }

  /**
   * 全量 DOM Diff 函数
   * @param c1 之前的children
   * @param c2 之后的children
   * @param el Dom元素
   */
  function patchKeyedChildren(c1, c2, el) {
    // 四指针算法
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;
    // 特殊情况1: sync from start 从头开始处理

    // 直到指针走完任意一个孩子的长度
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVNodeType(n1, n2)) {
        // dom diff
        patch(n1, n2, n1.el);
        i++;
      } else {
        // 头部顺序不存在可以进行 dom diff 的元素了
        break;
      }
    }
    console.log(i, e1, e2, 'n+++');

    // 特殊情况2: 同理 sync from end 从头在寻找对应可以 Dom Diff 的元素
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, n1.el);
        e1--;
        e2--;
      } else {
        break;
      }
    }

    // 特殊情况3: 将头部或者尾部对比完后，一个为另一个的子集 （i>e1 || e>e2）
    if (i > e1) {
      // 特殊情况3.1: 同序列逻辑 (子集关系) 增加
      // 1.同序列挂载 common sequence + mount
      // 如果 i>e1 表示 Dom diff 有新增的
      // 新增的范围为 i-e2 的区间
      if (i <= e2) {
        // 表示 dom diff 时存在新增
        while (i <= e2) {
          // 究竟往哪里插取决于 e2+1 位置是否存在元素
          // 新增时，如果是尾部插入 那么e2 + 1 后的位置应该没有Vnode 故从i位置appendChild
          // 新增时，如果顶部新增 那么e2 + 1 后的位置节点应该有值，并且是首部第一个元素，那么从i位置元素插入时候每次以e2+1位anchor即可
          const anchor = c2[e2 + 1] ? c2[e2 + 1].el : null;
          const newNode = normalize(c2[i]);
          patch(null, newNode, el, anchor);
          i++;
        }
      }
    } else if (i > e2) {
      // 特殊情况4.1: 同序列逻辑（子集关系）减少
      // 2.同序列挂载 common sequence + unmount
      if (i <= e1) {
        // 意为i将e2走完了，但是e1还有剩余，那么相当于e2为e1的子集
        while (i <= e1) {
          console.log(c1, 'c2');
          const oldNode = normalize(c1[i]);
          unmount(oldNode);
          i++;
        }
      }
    }

    // 非特殊情况:剩下的就是需要进行乱序对比的
    console.log(`i--${i}`, `el--${e1}`, `e2--${e2}`, 'xx');
  }

  /**
   * 比较两个虚拟节点children的差异
   * @param n1 旧的节点 vnode
   * @param n2 新的节点 vnode
   */
  function patchChildren(n1, n2) {
    const n1Children = n1.children;
    const n2Children = n2.children;

    const prevShapeFlag = n1.shapeFlag;

    const shapeFlag = n2.shapeFlag;

    // 现在是文本 进入
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // case: 1.新的是文本节点 旧的是数组节点 不需要DOMDiff
        // 卸载元素所有子节点 同时为元素设置文本节点
        unMountChildren(n1Children);
      }
      // 剩下就是说明之前也是文本
      if (n1Children !== n2Children) {
        hostSetElementText(n2.el, n2Children);
      }
    } else {
      // 现在一定非文本 有可能孩子为数组或者null
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // case: 两次孩子都是数组 DOM Diff
          // 全量DOM Diff 暂时不考虑靶向更新
          patchKeyedChildren(n1Children, n2Children, n2.el);
        } else {
          // case: 旧的是数组 新的是null空 这样的情况卸载之前的就OK
          unMountChildren(n1Children);
        }
      } else {
        // 之前一定不会是数组，
        // 之前不是数组，现在是非文本
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 之前是文本 需要清空文本节点
          hostSetElementText(n2.el, '');
        }
        // 现在如果是数组
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 将新的孩子元素节点进行挂载
          mountChildren(n2Children, n2.el);
        }
      }
    }
  }

  /**
   * 挂载元素
   */
  function mountElement(vnode, container, anchor) {
    const { shapeFlag, type, props, children } = vnode;
    // 1.根据元素类型创建元素
    vnode.el = hostCreateElement(type);
    // 2.属性
    if (props) {
      for (let key in props) {
        hostPatchProps(vnode.el, key, null, props[key]);
      }
    }
    // 3.儿子
    if (children) {
      if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // 文本
        hostSetElementText(vnode.el, children);
      } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 数组
        mountChildren(vnode.el, children);
      }
    }
    // 4.插入页面
    hostInsert(vnode.el, container, anchor);
  }

  /**
   * !相同元素（相同key）更新逻辑，涉及DOM Diff
   * @param n1
   * @param n2
   * @param container
   */
  function patchElement(n1, n2, container) {
    n2.el = n1.el;

    // 1.对比属性
    const n1Props = n1.props || {};
    const n2Props = n2.props || {};
    patchProps(n1Props, n2Props, n2.el);

    // 2.对比children
    patchChildren(n1, n2);
  }

  /**
   * 处理文本节点
   * @param n1
   * @param n2
   * @param container
   */
  function processText(n1, n2, container, anchor) {
    const { children } = n2;
    if (n1 === null) {
      // 创建
      n2.el = hostCreateText(children);
      hostInsert(n2.el, container, anchor);
    } else {
      // 更新
      // 1. 复用上一次的Dom节点 TextNode
      n2.el = n1.el;
      if (n2.children !== n1.children) {
        // 文本内容有更新 更新节点中的内容即可
        hostSetElementText(n2.el, n2.children);
      }
    }
  }

  /**
   * 处理元素节点
   * @param n1
   * @param n2
   * @param container
   */
  function processElement(n1, n2, container, anchor) {
    if (n1 === null) {
      mountElement(n2, container, anchor);
    } else {
      // 更新
      patchElement(n1, n2, container);
    }
  }

  // !核心:DomDiff patch 比对 vnode 方法方法
  function patch(n1, n2, container, anchor = null) {
    const { type, shapeFlag } = n2;
    // 不相同的元素节点 压根不需要DOM Diff
    if (n1 && !isSameVNodeType(n1, n2)) {
      // 删除n2
      unmount(n1);
      // 将n1变为null 接下来相当于重新创建n2进行挂载
      n1 = null;
    }
    switch (type) {
      // 文本
      case Text:
        processText(n1, n2, container, anchor);
        break;
      default:
        // 元素
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor);
        }
        break;
    }
  }

  return {
    render: (vnode, container) => {
      // 如果当前vNode可能为空 那么可能为卸载
      // 比如为 render(null, document.getElementById('app'))
      if (vnode === null) {
        // 卸载逻辑
        if (container.__vnode) unmount(container.__vnode);
      } else {
        // 当首次挂载时传入null container下不存在__vnode属性
        // 当更新时，元素内部存在__vnode属性，
        patch(container.__vnode || null, vnode, container);
      }
      // 缓存生成的vnode
      container.__vnode = vnode;
    },
  };
}