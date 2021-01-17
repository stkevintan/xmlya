import { XmlyaSDK } from '@xmlya/sdk';
import { CardsEntity } from '@xmlya/sdk/dist/types/getRecomends';
import {
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Event,
    ProviderResult,
    EventEmitter,
    ThemeIcon,
} from 'vscode';

class DiscoverTreeNode extends TreeItem {
    constructor(private entry: CardsEntity) {
        super(entry.title, TreeItemCollapsibleState.None);
    }

    description = this.entry.hotWord.join();
    iconPath = new ThemeIcon('repo');

    command = {
        command: 'xmlya.sidebar.recommendations',
        title: this.label!,
        arguments: [this.entry.title, this.entry.albumList],
    };

    // getChildren(): ProviderResult<[]> {
    //     return this.entry.albumList.map()
    // }
}

// class AudiobooksTreeNode extends DiscoverTreeNode {
//     constructor() {
//         super('有声书');
//     }
// }

// class MusicTreeNode extends DiscoverTreeNode {
//     constructor() {
//         super('音乐');
//     }
// }

// class EducationTreeNode extends DiscoverTreeNode {
//     constructor() {
//         super('教育');
//     }
// }

// class KidsTreeNode extends DiscoverTreeNode {
//     constructor() {
//         super('儿童');
//     }
// }

// class KnowledgeTreeNode extends DiscoverTreeNode {
//     constructor() {
//         super('知识');
//     }
// }

export class DiscoverTreeDataProvider implements TreeDataProvider<DiscoverTreeNode> {
    constructor(private sdk: XmlyaSDK) {}
    private _onDidChangeTreeData: EventEmitter<DiscoverTreeNode | undefined | void> = new EventEmitter<
        DiscoverTreeNode | undefined | void
    >();
    readonly onDidChangeTreeData: Event<DiscoverTreeNode | undefined | void> = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DiscoverTreeNode): TreeItem | Thenable<TreeItem> {
        return element;
    }

    async getChildren(element?: DiscoverTreeNode): Promise<DiscoverTreeNode[] | null | undefined> {
        if (element) {
            return null;
        }
        const { cards } = await this.sdk.getRecommend();
        return cards.map((c) => new DiscoverTreeNode(c));
        // return [
        //     new AudiobooksTreeNode(),
        //     new MusicTreeNode(),
        //     new EducationTreeNode(),
        //     new KidsTreeNode(),
        //     new KnowledgeTreeNode(),
        // ];
    }
}
