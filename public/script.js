/**
 * 文件名: script.js
 * 创建时间: 2025年10月2日
 * 文件内容: 用户管理系统前端JavaScript逻辑，处理所有用户交互和API调用
 * 
 * 主要功能:
 * 1. 用户认证 - 登录、注册、JWT令牌管理
 * 2. 管理员功能 - 用户管理、操作日志、权限控制
 * 3. 文件管理 - 上传、列表、编辑备注、删除恢复
 * 4. 分页控制 - 智能分页导航、页面大小选择、跳转功能
 * 5. UI交互 - 表单验证、模态框、加载状态、错误提示
 * 
 * 技术特性:
 * - 基于Fetch API的异步请求
 * - JWT身份验证和权限管理
 * - 响应式设计和移动端适配
 * - 文件上传进度和预览
 * - 智能分页和状态保持
 * 
 * 修改记录:
 * - 2025/10/02: 初始创建，实现登录注册基础功能
 * - 2025/10/02: 添加管理员用户管理和日志查看功能
 * - 2025/10/02: 实现文件上传功能，支持多文件和进度显示
 * - 2025/10/02: 添加文件操作功能（编辑备注、删除、恢复）
 * - 2025/10/02: 优化分页控件，从3行合并为1行布局
 * - 2025/10/02: 实现操作后页面状态保持功能
 * - 2025/10/02: 移除内联事件，改用addEventListener绑定
 * - 2025/10/02: 注释刷新按钮相关代码
 * - 2025/10/02: 添加文件说明注释
 * - 2025/10/02: 修复图片显示问题，实现带认证的blob URL加载
 * - 2025/10/02: 实现商家端客户管理和照片管理功能
 * - 2025/10/02: 添加筛选功能，支持按状态和时间筛选文件
 * - 2025/10/02: 实现批量下载功能，支持跨页选择和ZIP打包下载
 * - 2025/10/02: 优化备注显示，添加自定义模态框替代原生prompt
 * - 2025/10/02: 修复中文文件名显示问题，确保编码正确处理
 * - 2025/10/02: 添加图片放大查看模态框的异步加载功能
 * - 2025/10/02: 移除模态框内联onclick事件，完善CSP兼容性
 * - 2025/10/02: 实现客户端和商家端的完整筛选交互逻辑
 * - 2025/10/02: 重构分页系统，实现通用分页函数，统一三端分页逻辑
 * - 2025/10/02: 修复分页数据标准化问题，确保三端显示一致的分页控件
 * - 2025/10/02: 修复CSS样式冲突问题，解决HTML容器类名导致的分页显示异常
 * - 2025/10/02: 修复商家端客户照片分页参数传递问题，确保分页切换正常工作
 * - 2025/10/02: 添加修改密码和找回密码功能，包括页面切换和表单验证
 * - 2025/10/02: 优化管理员操作记录功能，添加中文翻译、可搜索筛选和分页
 * - 2025/10/03: 完善中文显示详情，优化操作记录详情格式和翻译
 * - 2025/10/03: 修复创建用户成功提示功能，解决函数冲突问题
 * - 2025/10/03: 修改操作记录默认每页显示条数从10条改为20条
 * - 2025/10/03: 优化创建用户表单描述文字，移除冗余说明
 */

// 全局变量
let currentUser = null;
let authToken = null;
let confirmAction = null;

// 操作记录中文映射
const operationTranslations = {
    // 登录相关
    'login_success': '登录成功',
    'login_failed': '登录失败',
    'logout': '退出登录',
    
    // 注册相关
    'register_success': '注册成功',
    'register_failed': '注册失败',
    
    // 密码相关
    'change_password_success': '修改密码成功',
    'change_password_failed': '修改密码失败',
    
    // 用户管理
    'create_user_success': '创建用户成功',
    'create_user_failed': '创建用户失败',
    'update_user_status': '更新用户状态',
    'toggle_user_status': '切换用户状态',
    
    // 文件操作
    'file_upload': '文件上传',
    'file_delete': '删除文件',
    'file_restore': '恢复文件',
    'edit_remarks': '编辑备注',
    
    // 照片操作
    'download_photo': '下载照片',
    'batch_download': '批量下载',
    'batch_download_selected': '批量下载选中',
    'update_photo_status': '更新照片状态',
    
    // 状态映射
    'received': '已接收',
    'processing': '处理中',
    'shipped': '已发货',
    'active': '正常',
    'inactive': '禁用'
};

// 操作记录全局变量
let currentLogsPage = 1;
let logsPageSize = 20;
let currentSelectedUserId = '';
let allUsers = []; // 存储所有用户数据
let currentPage = 1; // 当前页码（客户端文件管理）
let pageSize = 10; // 每页显示条数（客户端文件管理）
let merchantCurrentPage = 1; // 当前页码（商家端照片管理）
let merchantPageSize = 10; // 每页显示条数（商家端照片管理）
let currentFilters = {}; // 当前筛选条件（客户端）
let merchantFilters = {}; // 当前筛选条件（商家端）
let selectedFiles = []; // 当前选中的文件列表
let batchMode = false; // 是否处于批量选择模式
let selectedPhotos = new Set(); // 全局选中的照片ID集合

// 用户管理全局变量
let currentUserPage = 1; // 当前页码（用户管理）
let userPageSize = 10; // 每页显示条数（用户管理）
let currentUserSearch = ''; // 当前搜索关键词（用户管理）

// API 基础URL
const API_BASE = '/api';

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始初始化...');
    
    // 检查是否已登录
    const token = localStorage.getItem('authToken');
    if (token) {
        console.log('发现存储的令牌，验证中...');
        authToken = token;
        validateToken();
    } else {
        console.log('未发现令牌，显示登录页面');
        showLogin();
    }

    // 绑定表单事件
    bindFormEvents();
    
    // 绑定页面切换事件
    bindPageSwitchEvents();
    
    console.log('事件绑定完成');
});

// 绑定表单事件
function bindFormEvents() {
    console.log('开始绑定表单事件...');
    
    // 登录表单
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('✓ 登录表单事件已绑定');
    }
    
    // 注册表单
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        console.log('✓ 注册表单事件已绑定');
    }
    
    // 创建用户表单
    const createUserForm = document.getElementById('createUserForm');
    if (createUserForm) {
        createUserForm.addEventListener('submit', handleCreateUser);
        console.log('✓ 创建用户表单事件已绑定');
    }
    
    // 密码确认验证
    const confirmPassword = document.getElementById('confirmPassword');
    if (confirmPassword) {
        confirmPassword.addEventListener('input', validatePasswordMatch);
        console.log('✓ 密码确认验证事件已绑定');
    }
    
    // 页面切换链接
    const showRegisterLink = document.getElementById('showRegisterLink');
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegister();
        });
        console.log('✓ 注册链接事件已绑定');
    }
    
    const showLoginLink = document.getElementById('showLoginLink');
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
        });
        console.log('✓ 登录链接事件已绑定');
    }
    
    // 退出登录按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
        console.log('✓ 退出登录按钮事件已绑定');
    }
    
    // 管理员标签页按钮
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = btn.getAttribute('data-tab');
            if (tabName) {
                showTab(tabName, e);
            }
        });
    });
    if (tabBtns.length > 0) {
        console.log(`✓ ${tabBtns.length}个标签页按钮事件已绑定`);
    }
    
    // 刷新用户列表按钮 (已注释，用户习惯使用F5刷新)
    // const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    // if (refreshUsersBtn) {
    //     refreshUsersBtn.addEventListener('click', loadUsers);
    //     console.log('✓ 刷新用户按钮事件已绑定');
    // }
    
    // 搜索日志按钮
    const searchLogsBtn = document.getElementById('searchLogsBtn');
    if (searchLogsBtn) {
        searchLogsBtn.addEventListener('click', loadLogs);
        console.log('✓ 搜索日志按钮事件已绑定');
    }
    
    // 用户搜索框
    const userSearchInput = document.getElementById('userSearchInput');
    if (userSearchInput) {
        // 实时搜索（防抖）
        let searchTimeout;
        userSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentUserSearch = e.target.value;
                currentUserPage = 1; // 重置到第一页
                loadUsers(1);
            }, 300);
        });
        console.log('✓ 用户搜索框事件已绑定');
    }
    
    // 清除搜索按钮
    const clearUserSearch = document.getElementById('clearUserSearch');
    if (clearUserSearch) {
        clearUserSearch.addEventListener('click', () => {
            const searchInput = document.getElementById('userSearchInput');
            if (searchInput) {
                searchInput.value = '';
                currentUserSearch = '';
                currentUserPage = 1;
                loadUsers(1);
            }
        });
        console.log('✓ 清除用户搜索按钮事件已绑定');
    }
    
    // 用户分页事件绑定已内置到displayUsersPagination函数中，无需单独绑定
    
    // 密码切换按钮
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            if (targetId) {
                togglePassword(targetId);
            }
        });
    });
    if (togglePasswordBtns.length > 0) {
        console.log(`✓ ${togglePasswordBtns.length}个密码切换按钮事件已绑定`);
    }
    
    // 确认对话框按钮
    const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    if (cancelConfirmBtn) {
        cancelConfirmBtn.addEventListener('click', closeConfirmModal);
        console.log('✓ 取消确认按钮事件已绑定');
    }
    
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', executeConfirmedAction);
        console.log('✓ 确认按钮事件已绑定');
    }
    
    // 确认对话框背景点击关闭
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                closeConfirmModal();
            }
        });
        console.log('✓ 确认对话框背景点击事件已绑定');
    }
    
    // 文件上传表单
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFileUpload);
        console.log('✓ 文件上传表单事件已绑定');
    }
    
    // 文件选择预览
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
        console.log('✓ 文件选择事件已绑定');
    }
    
    // 自定义文件选择按钮
    const customFileButton = document.getElementById('customFileButton');
    if (customFileButton) {
        customFileButton.addEventListener('click', () => {
            fileInput.click(); // 触发隐藏的文件输入
        });
        console.log('✓ 自定义文件按钮事件已绑定');
    }
    
    // 刷新文件列表按钮 (已注释，用户习惯使用F5刷新)
    // const refreshFilesBtn = document.getElementById('refreshFilesBtn');
    // if (refreshFilesBtn) {
    //     refreshFilesBtn.addEventListener('click', loadUserFiles);
    //     console.log('✓ 刷新文件列表按钮事件已绑定');
    // }
    
    // 返回客户列表按钮
    const backToCustomersBtn = document.getElementById('backToCustomersBtn');
    if (backToCustomersBtn) {
        backToCustomersBtn.addEventListener('click', backToCustomers);
        console.log('✓ 返回客户列表按钮事件已绑定');
    }
    
    // 批量下载按钮（切换批量模式）
    const batchDownloadBtn = document.getElementById('batchDownloadBtn');
    if (batchDownloadBtn) {
        batchDownloadBtn.addEventListener('click', toggleBatchMode);
        console.log('✓ 批量下载按钮事件已绑定');
    }
    
    // 批量操作按钮组
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllPhotos);
        console.log('✓ 全选按钮事件已绑定');
    }
    
    const selectNoneBtn = document.getElementById('selectNoneBtn');
    if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', selectNonePhotos);
        console.log('✓ 全不选按钮事件已绑定');
    }
    
    const selectInvertBtn = document.getElementById('selectInvertBtn');
    if (selectInvertBtn) {
        selectInvertBtn.addEventListener('click', selectInvertPhotos);
        console.log('✓ 反选按钮事件已绑定');
    }
    
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    if (downloadSelectedBtn) {
        downloadSelectedBtn.addEventListener('click', downloadSelectedPhotos);
        console.log('✓ 下载选中按钮事件已绑定');
    }
    
    // 全选复选框（表头）
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAllCheckbox);
        console.log('✓ 全选复选框事件已绑定');
    }

    // 客户端筛选功能
    bindCustomerFilterEvents();
    
    // 商家端筛选功能
    bindMerchantFilterEvents();
    
    console.log('表单事件绑定完成');
}

// 显示/隐藏密码
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password i');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        button.className = 'fas fa-eye';
    }
}

// 密码确认验证
function validatePasswordMatch() {
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmInput = document.getElementById('confirmPassword');
    
    if (confirmPassword && password !== confirmPassword) {
        confirmInput.style.borderColor = '#dc3545';
    } else {
        confirmInput.style.borderColor = '#e1e5e9';
    }
}

// 显示页面
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// 显示登录页面
function showLogin() {
    showPage('loginPage');
    clearErrors();
}

// 显示注册页面
function showRegister() {
    showPage('registerPage');
    clearErrors();
}

// 显示仪表板
function showDashboard() {
    showPage('dashboardPage');
    updateUserInfo();
    
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'sub_admin')) {
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('merchantDashboard').style.display = 'none';
        document.getElementById('userDashboard').style.display = 'none';
        document.getElementById('customerDetailDashboard').style.display = 'none';
        loadUsers();
        updateCreateUserForm(); // 根据角色更新创建用户表单
    } else if (currentUser && currentUser.role === 'merchant') {
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('merchantDashboard').style.display = 'block';
        document.getElementById('userDashboard').style.display = 'none';
        document.getElementById('customerDetailDashboard').style.display = 'none';
        loadMerchantCustomers();
    } else {
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('merchantDashboard').style.display = 'none';
        document.getElementById('userDashboard').style.display = 'block';
        document.getElementById('customerDetailDashboard').style.display = 'none';
        
        // 如果是客户，显示文件上传功能
        if (currentUser && currentUser.role === 'customer') {
            document.getElementById('customerUpload').style.display = 'block';
            document.getElementById('filesList').style.display = 'block';
            loadMerchants();
            currentPage = 1; // 重置到第1页
            loadUserFiles(1);
        }
    }
}

// 更新用户信息显示
function updateUserInfo() {
    if (!currentUser) return;
    
    const userInfo = document.getElementById('userInfo');
    const roleText = getRoleText(currentUser.role);
    userInfo.textContent = `${currentUser.username} (${roleText})`;
    
    // 更新用户统计信息
    if (currentUser.created_at) {
        document.getElementById('userCreatedAt').textContent = formatDateTime(currentUser.created_at);
    }
    if (currentUser.last_login) {
        document.getElementById('userLastLogin').textContent = formatDateTime(currentUser.last_login);
    }
}

// 获取角色文本
function getRoleText(role) {
    const roleMap = {
        'admin': '主管理员',
        'sub_admin': '子管理员',
        'merchant': '商家',
        'customer': '客户'
    };
    return roleMap[role] || role;
}

// 格式化日期时间
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            
            showSuccess('登录成功！');
            setTimeout(() => {
                showDashboard();
            }, 1000);
        } else {
            showError('loginError', result.error || '登录失败');
        }
    } catch (error) {
        showError('loginError', '网络错误，请稍后重试');
    } finally {
        showLoading(false);
    }
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    // 验证密码匹配
    if (password !== confirmPassword) {
        showError('registerError', '两次输入的密码不匹配');
        return;
    }
    
    const registerData = {
        username: formData.get('username'),
        password: password,
        role: 'customer'  // 注册时默认创建客户账户
    };
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('注册成功！请登录您的账户。');
            setTimeout(() => {
                showLogin();
                // 预填用户名
                document.getElementById('loginUsername').value = registerData.username;
            }, 2000);
        } else {
            const errorMsg = result.errors ? 
                result.errors.map(err => err.msg).join(', ') : 
                result.error || '注册失败';
            showError('registerError', errorMsg);
        }
    } catch (error) {
        showError('registerError', '网络错误，请稍后重试');
    } finally {
        showLoading(false);
    }
}

// 验证令牌
async function validateToken() {
    try {
        const response = await fetch(`${API_BASE}/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            currentUser = result.user;
            showDashboard();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

// 退出登录
function logout() {
    console.log('执行退出登录...');
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    console.log('✓ 令牌已清除，跳转到登录页面');
    showLogin();
}

// 显示/隐藏加载状态
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

// 显示错误消息
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.add('show');
    
    setTimeout(() => {
        errorElement.classList.remove('show');
    }, 5000);
}

// 显示成功消息
function showSuccess(message) {
    // 创建成功消息元素
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message show';
    successDiv.textContent = message;
    
    // 查找合适的位置插入成功消息
    let targetElement = null;
    
    // 如果在管理员页面，优先插入到当前活动的标签页内容中
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        targetElement = activeTab;
    } else {
        // 否则查找其他活动页面
        targetElement = document.querySelector('.page.active .auth-card, .page.active .dashboard-content');
    }
    
    if (targetElement) {
        // 清除之前的成功消息
        const existingSuccess = targetElement.querySelector('.success-message');
        if (existingSuccess) {
            existingSuccess.remove();
        }
        
        targetElement.appendChild(successDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }
}

// 清除错误消息
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
    });
}

// 管理员功能：标签页切换
function showTab(tabName, event) {
    // 更新标签按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // 如果没有event，找到对应的按钮并激活
        const buttons = document.querySelectorAll('.tab-btn');
        buttons.forEach((btn, index) => {
            if ((tabName === 'users' && index === 0) ||
                (tabName === 'logs' && index === 1) ||
                (tabName === 'create' && index === 2)) {
                btn.classList.add('active');
            }
        });
    }
    
    // 显示对应内容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // 加载对应数据
    if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'logs') {
        loadLogs();
        loadUserFilter();
    }
}

// 加载用户列表（支持搜索、排序和分页）
async function loadUsers(page = currentUserPage) {
    console.log(`开始加载用户列表 - 页码: ${page}, 每页: ${userPageSize}, 搜索: "${currentUserSearch}"`);
    try {
        showLoading(true);
        
        // 构建查询参数
        const params = new URLSearchParams({
            page: page.toString(),
            limit: userPageSize.toString()
        });
        
        if (currentUserSearch.trim()) {
            params.append('search', currentUserSearch.trim());
        }
        
        const response = await fetch(`${API_BASE}/admin/users?${params}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('用户列表响应状态:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('用户列表数据:', result);
            
            currentUserPage = page;
            displayUsers(result.users);
            displayUsersPagination(result.pagination);
        } else {
            const errorText = await response.text();
            console.error('加载用户列表失败:', errorText);
            showError('usersError', '加载用户列表失败');
        }
    } catch (error) {
        console.error('加载用户列表网络错误:', error);
        showError('usersError', '网络错误');
    } finally {
        showLoading(false);
    }
}

// 显示用户列表
function displayUsers(users) {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td><span class="role-badge role-${user.role}">${getRoleText(user.role)}</span></td>
            <td><span class="status-badge status-${user.status}">${user.status === 'active' ? '正常' : '禁用'}</span></td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>${user.last_login ? formatDateTime(user.last_login) : '从未登录'}</td>
                    <td>
                        <div class="action-buttons">
                            ${user.id !== 1 ? `
                                <button class="btn btn-sm ${user.status === 'active' ? 'btn-danger' : 'btn-success'}" 
                                        data-action="toggle-status" data-user-id="${user.id}" data-user-status="${user.status}" data-username="${user.username}">
                                    ${user.status === 'active' ? '禁用' : '启用'}
                                </button>
                                <button class="btn btn-sm btn-warning" 
                                        data-action="reset-password" data-user-id="${user.id}" data-username="${user.username}">
                                    重置密码
                                </button>
                            ` : ''}
                        </div>
                    </td>
        `;
        tbody.appendChild(row);
    });
    
    // 绑定用户操作按钮事件
    const actionButtons = tbody.querySelectorAll('[data-action]');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('data-action');
            const userId = btn.getAttribute('data-user-id');
            
            if (action === 'toggle-status') {
                const userStatus = btn.getAttribute('data-user-status');
                const username = btn.getAttribute('data-username');
                toggleUserStatus(userId, userStatus, username);
            } else if (action === 'reset-password') {
                const username = btn.getAttribute('data-username');
                resetUserPassword(userId, username);
            } else if (action === 'view-logs') {
                viewUserLogs(userId);
            }
        });
    });
}

// 通用分页函数 - 统一所有端的分页实现
function displayUniversalPagination(containerId, pagination, options) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`分页控件容器未找到: ${containerId}`);
        return;
    }
    
    // 解构配置选项
    const {
        loadFunction,           // 数据加载函数
        getCurrentPage,         // 获取当前页码的函数
        setCurrentPage,         // 设置当前页码的函数
        getPageSize,            // 获取页面大小的函数
        setPageSize,            // 设置页面大小的函数
        pageSizeOptions = [10, 20, 50, 100], // 页面大小选项
        extraParams = []        // 额外参数（如customerId）
    } = options;
    
    // 标准化分页数据
    const normalizedPagination = {
        currentPage: pagination.currentPage || pagination.page || 1,
        totalPages: pagination.totalPages || pagination.pages || 1,
        totalRecords: pagination.totalRecords || pagination.totalUsers || pagination.total || 0,
        pageSize: pagination.pageSize || pagination.limit || getPageSize()
    };
    
    container.innerHTML = '';
    
    // 创建单行分页控件
    const paginationRow = document.createElement('div');
    paginationRow.className = 'pagination-single-row';
    
    // 左侧：每页显示条数
    const leftSection = document.createElement('div');
    leftSection.className = 'pagination-left';
    
    const pageSizeLabel = document.createElement('span');
    pageSizeLabel.textContent = '每页显示：';
    leftSection.appendChild(pageSizeLabel);
    
    const pageSizeSelect = document.createElement('select');
    pageSizeSelect.className = 'page-size-select';
    pageSizeOptions.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}条/页`;
        option.selected = size === normalizedPagination.pageSize;
        pageSizeSelect.appendChild(option);
    });
    
    pageSizeSelect.addEventListener('change', function() {
        setPageSize(parseInt(this.value));
        setCurrentPage(1); // 重置到第1页
        loadFunction(1, ...extraParams);
    });
    
    leftSection.appendChild(pageSizeSelect);
    paginationRow.appendChild(leftSection);
    
    // 中间：分页导航（只有多页时才显示）
    if (normalizedPagination.totalPages > 1) {
        const centerSection = document.createElement('div');
        centerSection.className = 'pagination-center';
        
        // 上一页按钮
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.title = '上一页';
        prevBtn.disabled = normalizedPagination.currentPage === 1;
        prevBtn.onclick = () => loadFunction(normalizedPagination.currentPage - 1, ...extraParams);
        centerSection.appendChild(prevBtn);
        
        // 页码按钮组
        const pageNumbers = document.createElement('div');
        pageNumbers.className = 'page-numbers';
        
        // 计算显示的页码范围（紧凑模式，只显示3个页码）
        let startPage = Math.max(1, normalizedPagination.currentPage - 1);
        let endPage = Math.min(normalizedPagination.totalPages, normalizedPagination.currentPage + 1);
        
        // 第一页
        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-btn page-number';
            firstBtn.textContent = '1';
            firstBtn.onclick = () => loadFunction(1, ...extraParams);
            pageNumbers.appendChild(firstBtn);
            
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }
        }
        
        // 中间页码
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn page-number ${i === normalizedPagination.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => loadFunction(i, ...extraParams);
            pageNumbers.appendChild(pageBtn);
        }
        
        // 最后一页
        if (endPage < normalizedPagination.totalPages) {
            if (endPage < normalizedPagination.totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-btn page-number';
            lastBtn.textContent = normalizedPagination.totalPages;
            lastBtn.onclick = () => loadFunction(normalizedPagination.totalPages, ...extraParams);
            pageNumbers.appendChild(lastBtn);
        }
        
        centerSection.appendChild(pageNumbers);
        
        // 下一页按钮
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.title = '下一页';
        nextBtn.disabled = normalizedPagination.currentPage === normalizedPagination.totalPages;
        nextBtn.onclick = () => loadFunction(normalizedPagination.currentPage + 1, ...extraParams);
        centerSection.appendChild(nextBtn);
        
        paginationRow.appendChild(centerSection);
    }
    
    // 右侧：跳转功能和信息
    const rightSection = document.createElement('div');
    rightSection.className = 'pagination-right';
    
    // 跳转功能
    if (normalizedPagination.totalPages > 1) {
        const jumpInput = document.createElement('input');
        jumpInput.type = 'number';
        jumpInput.className = 'jump-input';
        jumpInput.min = 1;
        jumpInput.max = normalizedPagination.totalPages;
        jumpInput.placeholder = '页码';
        
        const jumpBtn = document.createElement('button');
        jumpBtn.className = 'pagination-btn jump-btn';
        jumpBtn.textContent = '跳转';
        
        const handleJump = () => {
            const targetPage = parseInt(jumpInput.value);
            if (targetPage >= 1 && targetPage <= normalizedPagination.totalPages) {
                loadFunction(targetPage, ...extraParams);
                jumpInput.value = '';
            } else {
                alert(`请输入1-${normalizedPagination.totalPages}之间的页码`);
                jumpInput.focus();
            }
        };
        
        jumpBtn.onclick = handleJump;
        jumpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleJump();
            }
        });
        
        rightSection.appendChild(jumpInput);
        rightSection.appendChild(jumpBtn);
    }
    
    // 页面信息
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    if (normalizedPagination.totalPages > 1) {
        pageInfo.textContent = `第 ${normalizedPagination.currentPage}/${normalizedPagination.totalPages} 页`;
    }
    rightSection.appendChild(pageInfo);
    
    // 总记录数
    const totalInfo = document.createElement('span');
    totalInfo.className = 'total-info';
    totalInfo.textContent = `共 ${normalizedPagination.totalRecords} 条记录`;
    rightSection.appendChild(totalInfo);
    
    paginationRow.appendChild(rightSection);
    container.appendChild(paginationRow);
}

// 管理员端用户管理分页（使用通用分页函数）
function displayUsersPagination(pagination) {
    displayUniversalPagination('usersPagination', pagination, {
        loadFunction: loadUsers,
        getCurrentPage: () => currentUserPage,
        setCurrentPage: (page) => { currentUserPage = page; },
        getPageSize: () => userPageSize,
        setPageSize: (size) => { userPageSize = size; },
        extraParams: []
    });
}

// 切换用户状态
function toggleUserStatus(userId, currentStatus, username) {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const action = newStatus === 'disabled' ? '禁用' : '启用';
    
    if (newStatus === 'disabled') {
        showConfirmModal(
            `${action}用户`,
            `您确定要${action}用户 "${username}" 吗？`,
            () => updateUserStatus(userId, newStatus),
            true
        );
    } else {
        showConfirmModal(
            `${action}用户`,
            `您确定要${action}用户 "${username}" 吗？`,
            () => updateUserStatus(userId, newStatus),
            false
        );
    }
}

// 更新用户状态
async function updateUserStatus(userId, status) {
    const requestBody = { status };
    
    if (status === 'disabled') {
        const reason = document.getElementById('reasonInput').value.trim();
        if (!reason) {
            showError('confirmError', '请输入禁用理由');
            return;
        }
        requestBody.reason = reason;
    }
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess(result.message);
            loadUsers(currentUserPage); // 重新加载用户列表，保持当前页
            closeConfirmModal();
        } else {
            showError('confirmError', result.error || '操作失败');
        }
    } catch (error) {
        showError('confirmError', '网络错误');
    } finally {
        showLoading(false);
    }
}

// 重置用户密码
async function resetUserPassword(userId, username) {
    const newPassword = prompt(`请输入用户 ${username} 的新密码（至少6个字符）：`);
    
    if (!newPassword) {
        return; // 用户取消
    }
    
    if (newPassword.length < 6) {
        alert('密码长度至少需要6个字符');
        return;
    }
    
    if (!confirm(`确定要将用户 ${username} 的密码重置为 "${newPassword}" 吗？`)) {
        return; // 用户取消确认
    }
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/admin/reset-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId: userId,
                newPassword: newPassword
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            showSuccess(`用户 ${username} 的密码已重置成功`);
            loadUsers(currentUserPage); // 重新加载当前页
        } else {
            showError('usersError', result.error || '密码重置失败');
        }
    } catch (error) {
        showError('usersError', '网络错误，请稍后重试');
    } finally {
        showLoading(false);
    }
}

// 查看用户操作记录
// 查看用户日志功能已移除
// function viewUserLogs(userId) {
//     showTab('logs');
//     document.getElementById('userFilter').value = userId;
//     loadLogs();
// }

// 加载操作记录
async function loadLogs(page = currentLogsPage) {
    const userId = currentSelectedUserId;
    let url = `${API_BASE}/admin/logs`;
    if (userId) {
        url += `/${userId}`;
    }
    
    // 添加分页参数
    const params = new URLSearchParams({
        page: page.toString(),
        limit: logsPageSize.toString()
    });
    url += `?${params.toString()}`;
    
    try {
        showLoading(true);
        currentLogsPage = page; // 更新当前页码
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            displayLogs(result.logs);
            if (result.pagination) {
                displayLogsPagination(result.pagination);
            }
        } else {
            const errorData = await response.json();
            const errorMsg = errorData.error || '加载操作记录失败';
            showError('logsError', errorMsg);
        }
    } catch (error) {
        showError('logsError', '网络错误');
    } finally {
        showLoading(false);
    }
}

// 显示操作记录
function displayLogs(logs) {
    const tbody = document.querySelector('#logsTable tbody');
    tbody.innerHTML = '';
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDateTime(log.timestamp)}</td>
            <td>${log.username || '未知用户'}</td>
            <td>${translateOperation(log.operation)}</td>
            <td>${translateDetails(log.details || '-')}</td>
        `;
        tbody.appendChild(row);
    });
    
    // 绑定用户操作按钮事件
    const actionButtons = tbody.querySelectorAll('[data-action]');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('data-action');
            const userId = btn.getAttribute('data-user-id');
            
            if (action === 'toggle-status') {
                const userStatus = btn.getAttribute('data-user-status');
                const username = btn.getAttribute('data-username');
                toggleUserStatus(userId, userStatus, username);
            } else if (action === 'reset-password') {
                const username = btn.getAttribute('data-username');
                resetUserPassword(userId, username);
            } else if (action === 'view-logs') {
                viewUserLogs(userId);
            }
        });
    });
}

// 加载用户过滤器（基于权限）
async function loadUserFilter() {
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            allUsers = result.users; // 存储所有用户数据
            
            // 初始化可搜索下拉框
            initSearchableSelect();
            
            console.log(`✓ 加载了${result.users.length}个用户到过滤器`);
        }
    } catch (error) {
        console.error('加载用户过滤器失败:', error);
    }
}

// 初始化可搜索下拉框
function initSearchableSelect() {
    const input = document.getElementById('userFilterInput');
    const dropdown = document.getElementById('userFilterDropdown');
    
    if (!input || !dropdown) return;
    
    // 绑定输入事件
    input.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterUsers(searchTerm);
        showDropdown();
    });
    
    // 绑定焦点事件
    input.addEventListener('focus', (e) => {
        // 如果输入框有值（已选择用户），先清空以显示所有用户
        if (e.target.value && e.target.value !== '') {
            e.target.value = '';
        }
        filterUsers('');
        showDropdown();
    });
    
    // 绑定失焦事件（延迟隐藏以允许点击选项）
    input.addEventListener('blur', () => {
        setTimeout(() => {
            hideDropdown();
            // 如果输入框为空且之前有选择用户，恢复显示
            const selectedUser = input.getAttribute('data-selected-user');
            if (!input.value && selectedUser) {
                input.value = selectedUser;
            }
        }, 200);
    });
    
    // 初始显示所有用户
    filterUsers('');
}

// 筛选用户
function filterUsers(searchTerm) {
    const dropdown = document.getElementById('userFilterDropdown');
    const queryBtn = document.getElementById('searchLogsBtn');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    
    // 添加"所有用户"选项
    const allUsersText = currentUser.role === 'sub_admin' ? '所有可查看用户' : '所有用户';
    const allOption = document.createElement('div');
    allOption.className = 'dropdown-item';
    allOption.setAttribute('data-value', '');
    allOption.textContent = allUsersText;
    allOption.addEventListener('click', () => selectUser('', allUsersText));
    dropdown.appendChild(allOption);
    
    // 筛选并添加用户选项
    const filteredUsers = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm)
    );
    
    filteredUsers.forEach(user => {
        const option = document.createElement('div');
        option.className = 'dropdown-item';
        option.setAttribute('data-value', user.id);
        option.textContent = `${user.username} (${getRoleText(user.role)})`;
        option.addEventListener('click', () => selectUser(user.id, option.textContent));
        dropdown.appendChild(option);
    });
    
    // 控制查询按钮状态
    updateQueryButtonState(filteredUsers.length > 0, searchTerm);
}

// 更新查询按钮状态
function updateQueryButtonState(hasValidUsers, searchTerm) {
    const queryBtn = document.getElementById('searchLogsBtn');
    if (!queryBtn) return;
    
    // 如果有匹配的用户或者搜索框为空（显示所有用户），启用按钮
    if (hasValidUsers || !searchTerm || searchTerm.trim() === '') {
        queryBtn.disabled = false;
        queryBtn.classList.remove('btn-disabled');
        queryBtn.classList.add('btn-primary');
    } else {
        // 没有匹配的用户，禁用按钮
        queryBtn.disabled = true;
        queryBtn.classList.remove('btn-primary');
        queryBtn.classList.add('btn-disabled');
    }
}

// 选择用户
function selectUser(userId, displayText) {
    const input = document.getElementById('userFilterInput');
    if (input) {
        input.value = displayText;
        currentSelectedUserId = userId;
        // 存储选中的用户信息，用于失焦时恢复显示
        input.setAttribute('data-selected-user', displayText);
        
        // 选择用户后，确保查询按钮启用
        updateQueryButtonState(true, '');
    }
    hideDropdown();
}

// 显示下拉菜单
function showDropdown() {
    const dropdown = document.getElementById('userFilterDropdown');
    if (dropdown) {
        dropdown.classList.add('show');
    }
}

// 隐藏下拉菜单
function hideDropdown() {
    const dropdown = document.getElementById('userFilterDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// 处理创建用户
async function handleCreateUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        username: formData.get('username'),
        password: formData.get('password'),
        role: formData.get('role')
    };
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('用户创建成功！');
            e.target.reset(); // 清空表单
            
            // 如果当前在用户管理标签页，刷新用户列表
            if (document.getElementById('usersTab').classList.contains('active')) {
                loadUsers();
            }
        } else {
            const errorMsg = result.errors ? 
                result.errors.map(err => err.msg).join(', ') : 
                result.error || '创建用户失败';
            showError('createUserError', errorMsg);
        }
    } catch (error) {
        showError('createUserError', '网络错误，请稍后重试');
    } finally {
        showLoading(false);
    }
}

// 显示确认对话框
function showConfirmModal(title, message, action, needReason = false) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const reasonDiv = document.getElementById('confirmReason');
    if (needReason) {
        reasonDiv.style.display = 'block';
        document.getElementById('reasonInput').value = '';
    } else {
        reasonDiv.style.display = 'none';
    }
    
    confirmAction = action;
    document.getElementById('confirmModal').classList.add('show');
}

// 关闭确认对话框
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
    confirmAction = null;
}

// 执行确认的操作
function executeConfirmedAction() {
    if (confirmAction) {
        confirmAction();
    }
}

// 更新创建用户表单（基于角色权限）
function updateCreateUserForm() {
    const roleSelect = document.getElementById('newUserRole');
    const description = document.getElementById('createUserDescription');
    if (!roleSelect || !currentUser) return;
    
    // 清空现有选项
    roleSelect.innerHTML = '';
    
    if (currentUser.role === 'admin') {
        // 主管理员可以创建所有类型的用户
        roleSelect.innerHTML = `
            <option value="customer">客户</option>
            <option value="merchant">商家</option>
            <option value="sub_admin">子管理员</option>
        `;
        if (description) {
            description.textContent = '主管理员可以创建商家、子管理员等所有类型账户。';
        }
    } else if (currentUser.role === 'sub_admin') {
        // 子管理员只能创建商家和客户
        roleSelect.innerHTML = `
            <option value="customer">客户</option>
            <option value="merchant">商家</option>
        `;
        if (description) {
            description.textContent = '子管理员可以创建商家和客户账户。客户也可以自行注册。';
        }
    }
    
    console.log(`✓ 已根据${getRoleText(currentUser.role)}角色更新创建用户表单`);
}

// 加载商家列表
async function loadMerchants() {
    console.log('开始加载商家列表...');
    try {
        const response = await fetch(`${API_BASE}/merchants`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log(`商家API响应状态: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('商家API响应数据:', result);
            
            const select = document.getElementById('merchantSelect');
            if (!select) {
                console.error('找不到merchantSelect元素');
                return;
            }
            
            // 清空现有选项
            select.innerHTML = '<option value="">请选择商家</option>';
            
            // 添加商家选项
            result.merchants.forEach(merchant => {
                const option = document.createElement('option');
                option.value = merchant.id;
                option.textContent = merchant.username;
                select.appendChild(option);
            });
            
            console.log(`✓ 加载了${result.merchants.length}个商家`);
        } else {
            const errorData = await response.json();
            console.error('商家API请求失败:', response.status, errorData);
        }
    } catch (error) {
        console.error('加载商家列表失败:', error);
    }
}

// 处理文件选择
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('uploadPreview');
    
    if (files.length === 0) {
        preview.classList.remove('show');
        return;
    }
    
    // 添加新选择的文件到现有列表中
    files.forEach(file => {
        // 检查是否已经存在同名文件
        const existingIndex = selectedFiles.findIndex(f => f.name === file.name);
        if (existingIndex === -1) {
            selectedFiles.push(file);
        }
    });
    
    // 验证所有选中的文件（只在有文件时验证）
    if (selectedFiles.length > 0) {
        const validation = validateFiles(selectedFiles);
        if (!validation.valid) {
            showError('uploadError', validation.message);
            e.target.value = '';
            preview.classList.remove('show');
            return;
        }
    }
    
    // 显示文件预览
    displayFilePreview();
    clearErrors();
    
    // 清空文件输入，允许重复选择
    e.target.value = '';
}

// 验证文件
function validateFiles(files) {
    const maxFiles = 20;
    const maxImageSize = 50 * 1024 * 1024; // 50MB
    
    if (files.length > maxFiles) {
        return { valid: false, message: `最多只能选择${maxFiles}个文件` };
    }
    
    let imageCount = 0;
    let totalImageSize = 0;
    
    for (const file of files) {
        // 检查文件类型 - 既检查MIME类型又检查文件扩展名
        const isImage = isImageFile(file);
        const isArchive = isArchiveFile(file);
        
        if (!isImage && !isArchive) {
            return { valid: false, message: `不支持的文件类型: ${file.name}` };
        }
        
        if (isImage) {
            imageCount++;
            totalImageSize += file.size;
        }
    }
    
    if (imageCount > maxFiles) {
        return { valid: false, message: `图片文件不能超过${maxFiles}张` };
    }
    
    if (totalImageSize > maxImageSize) {
        return { valid: false, message: `图片文件总大小不能超过50MB` };
    }
    
    return { valid: true };
}

// 检查是否为图片文件
function isImageFile(file) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    const ext = getFileExtension(file.name);
    return file.type.startsWith('image/') || imageMimeTypes.includes(file.type) || imageExtensions.includes(ext);
}

// 检查是否为压缩包文件
function isArchiveFile(file) {
    const archiveExtensions = ['.zip', '.rar', '.7z'];
    const archiveMimeTypes = [
        'application/zip', 
        'application/x-zip-compressed',
        'application/x-rar-compressed', 
        'application/vnd.rar',
        'application/x-rar',
        'application/x-7z-compressed'
    ];
    
    const ext = getFileExtension(file.name);
    return archiveMimeTypes.includes(file.type) || archiveExtensions.includes(ext);
}

// 获取文件扩展名
function getFileExtension(filename) {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
}

// 显示文件预览
function displayFilePreview() {
    const filesList = document.getElementById('selectedFilesList');
    const filesContent = document.getElementById('selectedFilesContent');
    
    if (selectedFiles.length === 0) {
        filesList.style.display = 'none';
        return;
    }
    
    filesContent.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const isImage = isImageFile(file);
        const fileItem = document.createElement('div');
        fileItem.className = 'selected-file-item';
        
        fileItem.innerHTML = `
            <div class="selected-file-icon ${isImage ? 'image' : 'archive'}">
                <i class="fas ${isImage ? 'fa-image' : 'fa-file-archive'}"></i>
            </div>
            <div class="selected-file-details">
                <div class="selected-file-name">${file.name}</div>
                <div class="selected-file-size">${formatFileSize(file.size)}</div>
            </div>
            <button type="button" class="selected-file-remove" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // 为删除按钮绑定事件监听器
        const removeBtn = fileItem.querySelector('.selected-file-remove');
        removeBtn.addEventListener('click', () => removeFile(index));
        
        filesContent.appendChild(fileItem);
    });
    
    filesList.style.display = 'block';
}

// 移除文件
function removeFile(index) {
    // 从选中文件列表中移除
    selectedFiles.splice(index, 1);
    
    // 重新显示预览
    displayFilePreview();
    
    // 如果没有文件了，清除错误信息
    if (selectedFiles.length === 0) {
        clearErrors();
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 处理文件上传
async function handleFileUpload(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const merchantId = document.getElementById('merchantSelect').value;
    const remarks = document.getElementById('remarksInput').value;
    
    // 验证
    if (!merchantId) {
        showError('uploadError', '请选择商家');
        return;
    }
    
    if (selectedFiles.length === 0) {
        showError('uploadError', '请选择要上传的文件');
        return;
    }

    // 检测重复文件
    const fileNames = selectedFiles.map(file => file.name);
    const duplicateCheck = await checkDuplicateFiles(merchantId, fileNames);
    
    if (!duplicateCheck.success) {
        showError('uploadError', duplicateCheck.error);
        return;
    }
    
    if (duplicateCheck.duplicateFiles && duplicateCheck.duplicateFiles.length > 0) {
        const duplicateList = duplicateCheck.duplicateFiles.join('、');
        showError('uploadError', `以下文件已经上传过，请勿重复上传：${duplicateList}`);
        return;
    }
    
    // 添加文件到FormData
    for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
    }
    formData.append('merchantId', merchantId);
    if (remarks) {
        formData.append('remarks', remarks);
    }
    
    try {
        showLoading(true);
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
        
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess(`文件上传成功！已上传${result.files.length}个文件到商家：${result.merchant}`);
            
            // 清空表单和选中文件
            document.getElementById('uploadForm').reset();
            document.getElementById('selectedFilesList').style.display = 'none';
            selectedFiles = []; // 清空选中文件列表
            
            // 刷新文件列表，保持当前页
            loadUserFiles(currentPage);
        } else {
            showError('uploadError', result.error || '文件上传失败');
        }
    } catch (error) {
        showError('uploadError', '网络错误，请稍后重试');
    } finally {
        showLoading(false);
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传文件';
    }
}

// 加载用户文件列表
async function loadUserFiles(page = currentPage) {
    try {
        showLoading(true);
        currentPage = page; // 更新当前页码
        
        // 构建查询参数
        const params = new URLSearchParams({
            page: page.toString(),
            limit: pageSize.toString()
        });

        // 添加筛选参数
        if (currentFilters.status) {
            params.append('status', currentFilters.status);
        }
        if (currentFilters.timeFilter) {
            params.append('timeFilter', currentFilters.timeFilter);
        }
        if (currentFilters.startDate) {
            params.append('startDate', currentFilters.startDate);
        }
        if (currentFilters.endDate) {
            params.append('endDate', currentFilters.endDate);
        }

        const response = await fetch(`${API_BASE}/uploads?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            displayUserFiles(result.files);
            displayPagination(result.pagination);
        } else {
            showError('filesError', '加载文件列表失败');
        }
    } catch (error) {
        showError('filesError', '网络错误');
    } finally {
        showLoading(false);
    }
}

// 显示用户文件列表
function displayUserFiles(files) {
    const tbody = document.querySelector('#filesTable tbody');
    tbody.innerHTML = '';
    
    if (files.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align: center;">暂无文件</td>';
        tbody.appendChild(row);
        return;
    }
    
    files.forEach(file => {
        const row = document.createElement('tr');
        
        // 根据文件状态设置样式
        if (file.status === 'deleted') {
            row.classList.add('deleted-file-row');
        }
        
        const uploadTime = formatDateTime(file.upload_time);
        const fileSize = formatFileSize(file.file_size);
        
        // 处理状态显示
        const processStatusText = getProcessStatusText(file.process_status);
        const processStatusClass = getProcessStatusClass(file.process_status);
        
        // 编辑次数显示
        const editCount = file.edit_count || 0;
        const editInfo = `${editCount}/10`;
        const canEdit = editCount < 10 && file.status === 'active';
        
        // 构建图片/文件显示内容
        let imageContent = '';
        if (file.file_type === 'image') {
            // 显示实际图片
            imageContent = `
                <div class="file-image-container">
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMTIwIDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIGZpbGw9IiNmOGY5ZmEiLz48dGV4dCB4PSI2MCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+5Yqg6L295LitLi4uPC90ZXh0Pjwvc3ZnPg==" 
                         alt="${file.original_name}" 
                         class="file-image" 
                         data-filename="${file.file_name}"
                         data-original-name="${file.original_name}">
                    <div class="image-error" style="display:none;">
                        <i class="fas fa-image"></i>
                        <span>图片加载失败</span>
                    </div>
                    <div class="file-name">${file.original_name}</div>
                </div>
            `;
        } else {
            // 显示压缩包图标
            const archiveIcon = getArchiveIcon(file.original_name);
            imageContent = `
                <div class="file-archive-container">
                    <div class="archive-icon">
                        <i class="${archiveIcon}"></i>
                    </div>
                    <div class="file-name">${file.original_name}</div>
                </div>
            `;
        }

        row.innerHTML = `
            <td class="file-preview-cell">${imageContent}</td>
            <td><span class="file-type-badge file-type-${file.file_type}">${file.file_type === 'image' ? '图片' : '压缩包'}</span></td>
            <td>${fileSize}</td>
            <td>${file.merchant_name}</td>
            <td>${uploadTime}</td>
            <td>
                <div class="remarks-cell">
                    <span class="remarks-text" id="remarks-${file.id}" 
                          title="${file.remarks || ''}" 
                          data-remarks="${(file.remarks || '').replace(/"/g, '&quot;')}"
                          data-clickable="${file.remarks && file.remarks.length > 30 ? 'true' : 'false'}"
                          style="cursor: ${file.remarks && file.remarks.length > 30 ? 'pointer' : 'default'}">
                        ${file.remarks || '-'}
                    </span>
                    <div class="edit-info">编辑次数: ${editInfo}</div>
                </div>
            </td>
            <td>
                <span class="process-status ${processStatusClass}">
                    ${processStatusText}
                </span>
            </td>
            <td>
                <div class="file-actions">
                    ${file.status === 'active' ? `
                        ${canEdit ? `<button class="btn-edit" data-file-id="${file.id}" data-current-remarks="${(file.remarks || '').replace(/"/g, '&quot;')}">
                            <i class="fas fa-edit"></i> 编辑备注
                        </button>` : '<span class="edit-disabled">编辑次数已用完</span>'}
                        <button class="btn-delete" data-file-id="${file.id}">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    ` : `
                        <button class="btn-restore" data-file-id="${file.id}">
                            <i class="fas fa-undo"></i> 恢复
                        </button>
                        <span class="deleted-status">已删除</span>
                    `}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // 绑定事件监听器
    bindFileActionEvents();
    
    // 异步加载图片
    loadImagesAsync();
}

// 加载商家的客户列表
async function loadMerchantCustomers(page = 1) {
    console.log('开始加载商家客户列表...');
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/merchant/customers?page=${page}&limit=10`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            displayMerchantCustomers(result.customers);
            displayCustomersPagination(result.pagination);
        } else {
            showError('customersError', '加载客户列表失败');
        }
    } catch (error) {
        console.error('加载客户列表错误:', error);
        showError('customersError', '网络错误');
    } finally {
        showLoading(false);
    }
}

// 显示商家客户列表
function displayMerchantCustomers(customers) {
    const tbody = document.querySelector('#merchantCustomersTable tbody');
    tbody.innerHTML = '';
    
    if (customers.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center;">暂无客户</td>';
        tbody.appendChild(row);
        return;
    }
    
    customers.forEach(customer => {
        const row = document.createElement('tr');
        
        const lastUploadTime = formatDateTime(customer.last_upload_time);
        const statusText = customer.status === 'active' ? '正常' : '禁用';
        const statusClass = customer.status === 'active' ? 'status-active' : 'status-disabled';
        
        const isDisabled = customer.status !== 'active';
        const buttonClass = isDisabled ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm btn-view-customer';
        const buttonDisabled = isDisabled ? 'disabled' : '';
        const buttonTitle = isDisabled ? '客户已被禁用' : '查看照片';
        
        row.innerHTML = `
            <td>${customer.id}</td>
            <td>${customer.username}</td>
            <td>${customer.file_count}</td>
            <td>${lastUploadTime}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="${buttonClass}" 
                            data-customer-id="${customer.id}" 
                            data-customer-name="${customer.username}"
                            ${buttonDisabled}
                            title="${buttonTitle}">
                        <i class="fas fa-eye"></i> 查看照片
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // 绑定查看客户按钮事件
    bindCustomerActionEvents();
}

// 商家端客户分页（使用通用分页函数）
function displayCustomersPagination(pagination) {
    displayUniversalPagination('customersPagination', pagination, {
        loadFunction: loadMerchantCustomers,
        getCurrentPage: () => merchantCurrentPage,
        setCurrentPage: (page) => { merchantCurrentPage = page; },
        getPageSize: () => merchantPageSize,
        setPageSize: (size) => { merchantPageSize = size; },
        extraParams: []
    });
}

// 绑定客户操作事件
function bindCustomerActionEvents() {
    // 查看客户照片按钮（只绑定未禁用的按钮）
    document.querySelectorAll('.btn-view-customer').forEach(button => {
        if (!button.hasAttribute('disabled')) {
            button.addEventListener('click', function() {
                const customerId = this.getAttribute('data-customer-id');
                const customerName = this.getAttribute('data-customer-name');
                showCustomerDetail(customerId, customerName);
            });
        }
    });
}

// 显示客户详情页面
function showCustomerDetail(customerId, customerName) {
    console.log(`显示客户详情: ID=${customerId}, 姓名=${customerName}`);
    
    // 隐藏商家面板，显示客户详情面板
    document.getElementById('merchantDashboard').style.display = 'none';
    document.getElementById('customerDetailDashboard').style.display = 'block';
    
    // 更新标题
    document.getElementById('customerDetailTitle').innerHTML = 
        `<i class="fas fa-user"></i> ${customerName} 的照片管理`;
    
    // 存储当前客户信息，供返回按钮使用
    window.currentCustomerId = customerId;
    window.currentCustomerName = customerName;
    
    // 重置分页状态
    merchantCurrentPage = 1;
    
    // 加载客户照片
    loadCustomerPhotos(customerId, 1);
}

// 返回客户列表
function backToCustomers() {
    document.getElementById('customerDetailDashboard').style.display = 'none';
    document.getElementById('merchantDashboard').style.display = 'block';
}

// 加载客户照片列表
async function loadCustomerPhotos(customerId, page = merchantCurrentPage) {
    console.log(`加载客户照片: ID=${customerId}, 页码=${page}`);
    try {
        showLoading(true);
        merchantCurrentPage = page; // 更新当前页码
        
        // 构建查询参数
        const params = new URLSearchParams({
            page: page.toString(),
            limit: merchantPageSize.toString()
        });

        // 添加筛选参数
        if (merchantFilters.status) {
            params.append('status', merchantFilters.status);
        }
        if (merchantFilters.timeFilter) {
            params.append('timeFilter', merchantFilters.timeFilter);
        }
        if (merchantFilters.startDate) {
            params.append('startDate', merchantFilters.startDate);
        }
        if (merchantFilters.endDate) {
            params.append('endDate', merchantFilters.endDate);
        }
        
        const response = await fetch(`${API_BASE}/merchant/customer/${customerId}/photos?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            displayCustomerPhotos(result.photos);
            displayCustomerPhotosPagination(result.pagination, customerId);
        } else if (response.status === 403) {
            // 客户被禁用，返回客户列表并显示提示
            const errorData = await response.json();
            alert(errorData.error || '该客户已被禁用，无法查看照片');
            backToCustomers();
        } else {
            showError('customerPhotosError', '加载照片列表失败');
        }
    } catch (error) {
        console.error('加载照片列表错误:', error);
        showError('customerPhotosError', '网络错误');
    } finally {
        showLoading(false);
    }
}

// 显示客户照片列表
function displayCustomerPhotos(photos) {
    const tbody = document.querySelector('#customerPhotosTable tbody');
    tbody.innerHTML = '';
    
    if (photos.length === 0) {
        const row = document.createElement('tr');
        const colspanCount = batchMode ? 9 : 8;
        row.innerHTML = `<td colspan="${colspanCount}" style="text-align: center;">暂无照片</td>`;
        tbody.appendChild(row);
        return;
    }
    
    photos.forEach(photo => {
        const row = document.createElement('tr');
        
        // 如果是已删除的照片，添加特殊样式
        if (photo.status === 'deleted') {
            row.classList.add('deleted-photo-row');
        }
        
        const uploadTime = formatDateTime(photo.upload_time);
        const fileSize = formatFileSize(photo.file_size);
        
        // 处理状态显示
        const processStatusText = getProcessStatusText(photo.process_status);
        const processStatusClass = getProcessStatusClass(photo.process_status);
        
        // 下载状态显示
        const downloadStatusText = getDownloadStatusText(photo.download_status);
        const downloadStatusClass = getDownloadStatusClass(photo.download_status);
        
        // 构建图片显示内容
        let imageContent = '';
        if (photo.file_type === 'image') {
            imageContent = `
                <div class="file-image-container">
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMTIwIDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIGZpbGw9IiNmOGY5ZmEiLz48dGV4dCB4PSI2MCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+5Yqg6L295LitLi4uPC90ZXh0Pjwvc3ZnPg==" 
                         alt="${photo.original_name}" 
                         class="file-image" 
                         data-filename="${photo.file_name}"
                         data-original-name="${photo.original_name}">
                    <div class="image-error" style="display:none;">
                        <i class="fas fa-image"></i>
                        <span>图片加载失败</span>
                    </div>
                    <div class="file-name">${photo.original_name}</div>
                </div>
            `;
        } else {
            const archiveIcon = getArchiveIcon(photo.original_name);
            imageContent = `
                <div class="file-archive-container">
                    <div class="archive-icon">
                        <i class="${archiveIcon}"></i>
                    </div>
                    <div class="file-name">${photo.original_name}</div>
                </div>
            `;
        }
        
        // 操作按钮
        let actionButtons = '';
        if (photo.status === 'active') {
            actionButtons = `
                <div class="action-buttons">
                    <select class="status-select" data-photo-id="${photo.id}" data-current-status="${photo.process_status}">
                        <option value="received" ${photo.process_status === 'received' ? 'selected' : ''}>已接收</option>
                        <option value="processing" ${photo.process_status === 'processing' ? 'selected' : ''}>处理中</option>
                        <option value="shipped" ${photo.process_status === 'shipped' ? 'selected' : ''}>已发货</option>
                    </select>
                    <button class="btn btn-primary btn-sm btn-download" data-photo-id="${photo.id}">
                        <i class="fas fa-download"></i> 下载
                    </button>
                </div>
            `;
        } else {
            actionButtons = '<span class="text-muted">已删除</span>';
        }
        
        // 构建复选框列（批量模式时显示）
        let checkboxColumn = '';
        if (batchMode && photo.status === 'active') {
            const isChecked = selectedPhotos.has(photo.id);
            checkboxColumn = `
                <td class="checkbox-column">
                    <input type="checkbox" class="photo-checkbox" 
                           data-photo-id="${photo.id}" 
                           ${isChecked ? 'checked' : ''}>
                </td>
            `;
            if (isChecked) {
                row.classList.add('selected');
            }
        } else if (batchMode) {
            checkboxColumn = '<td class="checkbox-column"></td>';
        }

        row.innerHTML = `
            ${checkboxColumn}
            <td class="file-preview-cell">${imageContent}</td>
            <td><span class="file-type-badge file-type-${photo.file_type}">${photo.file_type === 'image' ? '图片' : '压缩包'}</span></td>
            <td>${fileSize}</td>
            <td>${uploadTime}</td>
            <td class="remarks-cell">
                <div class="remarks-text" 
                     title="${photo.remarks || ''}"
                     data-remarks="${(photo.remarks || '').replace(/"/g, '&quot;')}"
                     data-clickable="${photo.remarks && photo.remarks.length > 30 ? 'true' : 'false'}"
                     style="cursor: ${photo.remarks && photo.remarks.length > 30 ? 'pointer' : 'default'}">
                    ${photo.remarks || '-'}
                </div>
            </td>
            <td><span class="status-badge ${processStatusClass}">${processStatusText}</span></td>
            <td><span class="status-badge ${downloadStatusClass}">${downloadStatusText}</span></td>
            <td>${actionButtons}</td>
        `;
        tbody.appendChild(row);
    });
    
    // 绑定照片操作事件
    bindPhotoActionEvents();
    
    // 异步加载图片（商家端照片管理）
    loadMerchantImagesAsync();
}

// 商家端客户照片分页（使用通用分页函数）
function displayCustomerPhotosPagination(pagination, customerId) {
    displayUniversalPagination('customerPhotosPagination', pagination, {
        loadFunction: (page) => loadCustomerPhotos(customerId, page),
        getCurrentPage: () => merchantCurrentPage,
        setCurrentPage: (page) => { merchantCurrentPage = page; },
        getPageSize: () => merchantPageSize,
        setPageSize: (size) => { merchantPageSize = size; },
        extraParams: []
    });
}

// 绑定照片操作事件
function bindPhotoActionEvents() {
    // 图片点击事件（商家端照片管理）
    document.querySelectorAll('#customerPhotosTable .file-image[data-filename]').forEach(img => {
        img.addEventListener('click', function() {
            const filename = this.getAttribute('data-filename');
            const originalName = this.getAttribute('data-original-name');
            openImageModal(filename, originalName);
        });
    });
    
    // 状态选择器变化事件
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', function() {
            const photoId = this.getAttribute('data-photo-id');
            const newStatus = this.value;
            const currentStatus = this.getAttribute('data-current-status');
            
            if (newStatus !== currentStatus) {
                updatePhotoStatus(photoId, newStatus, this);
            }
        });
    });
    
    // 下载按钮事件
    document.querySelectorAll('.btn-download').forEach(button => {
        button.addEventListener('click', function() {
            const photoId = this.getAttribute('data-photo-id');
            downloadPhoto(photoId);
        });
    });
    
    // 备注点击事件（商家端）
    document.querySelectorAll('#customerPhotosTable .remarks-text[data-clickable="true"]').forEach(element => {
        element.addEventListener('click', function() {
            const remarks = this.getAttribute('data-remarks');
            showRemarksModal('photo', remarks);
        });
    });
    
    // 复选框事件（批量模式）
    document.querySelectorAll('.photo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const photoId = parseInt(this.getAttribute('data-photo-id'));
            const row = this.closest('tr');
            
            if (this.checked) {
                selectedPhotos.add(photoId);
                row.classList.add('selected');
            } else {
                selectedPhotos.delete(photoId);
                row.classList.remove('selected');
            }
            
            updateSelectAllCheckbox();
            updateSelectedCount();
        });
    });
}

// 更新照片处理状态
async function updatePhotoStatus(photoId, newStatus, selectElement) {
    try {
        const response = await fetch(`${API_BASE}/merchant/photo/${photoId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ process_status: newStatus })
        });
        
        if (response.ok) {
            selectElement.setAttribute('data-current-status', newStatus);
            showSuccess('状态更新成功');
            // 刷新当前页面以更新状态显示
            loadCustomerPhotos(window.currentCustomerId, merchantCurrentPage);
        } else {
            const result = await response.json();
            showError('customerPhotosError', result.error || '状态更新失败');
            // 恢复原状态
            selectElement.value = selectElement.getAttribute('data-current-status');
        }
    } catch (error) {
        console.error('更新状态错误:', error);
        showError('customerPhotosError', '网络错误');
        // 恢复原状态
        selectElement.value = selectElement.getAttribute('data-current-status');
    }
}

// 下载单张照片
function downloadPhoto(photoId) {
    const downloadUrl = `${API_BASE}/merchant/photo/${photoId}/download`;
    
    // 创建隐藏的下载链接
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.style.display = 'none';
    
    // 添加认证头（通过在URL中添加token参数，因为a标签无法设置headers）
    // 这里我们使用window.open的方式来下载
    window.open(`${downloadUrl}?token=${authToken}`, '_blank');
}

// 批量下载所有照片
function batchDownloadPhotos() {
    if (!window.currentCustomerId) {
        showError('customerPhotosError', '客户信息丢失');
        return;
    }
    
    const downloadUrl = `${API_BASE}/merchant/customer/${window.currentCustomerId}/download-all`;
    window.open(`${downloadUrl}?token=${authToken}`, '_blank');
}

// 获取处理状态文本
function getProcessStatusText(status) {
    const statusMap = {
        'received': '已接收',
        'processing': '处理中',
        'shipped': '已发货'
    };
    return statusMap[status] || '未知';
}

// 获取处理状态样式类
function getProcessStatusClass(status) {
    const classMap = {
        'received': 'status-received',
        'processing': 'status-processing',
        'shipped': 'status-shipped'
    };
    return classMap[status] || 'status-unknown';
}

// 获取下载状态文本
function getDownloadStatusText(status) {
    if (!status) return '未下载';
    const statusMap = {
        'success': '已下载',
        'failed': '下载失败',
        'retry': '重试中'
    };
    return statusMap[status] || '未知';
}

// 获取下载状态样式类
function getDownloadStatusClass(status) {
    if (!status) return 'status-not-downloaded';
    const classMap = {
        'success': 'status-downloaded',
        'failed': 'status-download-failed',
        'retry': 'status-download-retry'
    };
    return classMap[status] || 'status-unknown';
}

// 异步加载图片（商家端照片管理专用）
async function loadMerchantImagesAsync() {
    const images = document.querySelectorAll('#customerPhotosTable .file-image[data-filename]');
    
    for (const img of images) {
        const filename = img.getAttribute('data-filename');
        try {
            const response = await fetch(`/uploads/${filename}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                img.src = imageUrl;
                
                // 清理旧的blob URL（如果有的话）
                img.addEventListener('load', () => {
                    if (img.dataset.oldUrl) {
                        URL.revokeObjectURL(img.dataset.oldUrl);
                    }
                    img.dataset.oldUrl = imageUrl;
                });
            } else {
                console.error(`加载图片失败: ${filename}, 状态: ${response.status}`);
                img.style.display = 'none';
                img.nextElementSibling.style.display = 'block';
            }
        } catch (error) {
            console.error(`加载图片出错: ${filename}`, error);
            img.style.display = 'none';
            img.nextElementSibling.style.display = 'block';
        }
    }
}

// 异步加载图片（客户端文件管理专用）
async function loadImagesAsync() {
    const images = document.querySelectorAll('#filesTable .file-image[data-filename]');
    
    for (const img of images) {
        const filename = img.getAttribute('data-filename');
        try {
            const response = await fetch(`/uploads/${filename}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                img.src = imageUrl;
                
                // 清理旧的blob URL（如果有的话）
                img.addEventListener('load', () => {
                    if (img.dataset.oldUrl) {
                        URL.revokeObjectURL(img.dataset.oldUrl);
                    }
                    img.dataset.oldUrl = imageUrl;
                });
            } else {
                console.error(`加载图片失败: ${filename}, 状态: ${response.status}`);
                img.style.display = 'none';
                img.nextElementSibling.style.display = 'block';
            }
        } catch (error) {
            console.error(`加载图片出错: ${filename}`, error);
            img.style.display = 'none';
            img.nextElementSibling.style.display = 'block';
        }
    }
}

// 获取压缩包图标
function getArchiveIcon(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const iconMap = {
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive', 
        '7z': 'fas fa-file-archive',
        'tar': 'fas fa-file-archive',
        'gz': 'fas fa-file-archive'
    };
    return iconMap[ext] || 'fas fa-file-archive';
}

// 打开图片放大查看模态框
async function openImageModal(filename, originalName) {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <div class="image-modal-header">
                <h3>${originalName}</h3>
                <button class="image-modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="image-modal-body">
                <div class="modal-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>加载中...</span>
                </div>
                <img src="" alt="${originalName}" class="modal-image" style="display:none;">
            </div>
        </div>
        <div class="image-modal-overlay"></div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加关闭事件监听器
    modal.querySelector('.image-modal-close').addEventListener('click', closeImageModal);
    modal.querySelector('.image-modal-overlay').addEventListener('click', closeImageModal);
    
    // 异步加载图片
    try {
        const response = await fetch(`/uploads/${filename}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            const img = modal.querySelector('.modal-image');
            const loading = modal.querySelector('.modal-loading');
            
            img.src = imageUrl;
            img.style.display = 'block';
            loading.style.display = 'none';
            
            // 清理blob URL
            img.addEventListener('load', () => {
                if (img.dataset.blobUrl) {
                    URL.revokeObjectURL(img.dataset.blobUrl);
                }
                img.dataset.blobUrl = imageUrl;
            });
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('加载模态框图片失败:', error);
        const loading = modal.querySelector('.modal-loading');
        loading.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>图片加载失败</span>
        `;
    }
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleImageModalKeydown);
}

// 关闭图片模态框
function closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) {
        modal.remove();
        document.removeEventListener('keydown', handleImageModalKeydown);
    }
}

// 处理图片模态框键盘事件
function handleImageModalKeydown(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
}

// 绑定文件操作事件
function bindFileActionEvents() {
    // 图片点击事件（客户端文件管理）
    document.querySelectorAll('#filesTable .file-image[data-filename]').forEach(img => {
        img.addEventListener('click', function() {
            const filename = this.getAttribute('data-filename');
            const originalName = this.getAttribute('data-original-name');
            openImageModal(filename, originalName);
        });
    });
    
    // 编辑备注按钮
    document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', function() {
            const fileId = this.getAttribute('data-file-id');
            const currentRemarks = this.getAttribute('data-current-remarks');
            editRemarks(fileId, currentRemarks);
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', function() {
            const fileId = this.getAttribute('data-file-id');
            deleteFile(fileId);
        });
    });
    
    // 恢复按钮
    document.querySelectorAll('.btn-restore').forEach(button => {
        button.addEventListener('click', function() {
            const fileId = this.getAttribute('data-file-id');
            restoreFile(fileId);
        });
    });
    
    // 备注点击事件（客户端）
    document.querySelectorAll('#filesTable .remarks-text[data-clickable="true"]').forEach(element => {
        element.addEventListener('click', function() {
            const remarks = this.getAttribute('data-remarks');
            const fileId = this.id.replace('remarks-', '');
            showRemarksModal(fileId, remarks);
        });
    });
}

// 获取处理状态文本
function getProcessStatusText(status) {
    const statusMap = {
        'received': '已接收',
        'processing': '处理中', 
        'shipped': '已发货'
    };
    return statusMap[status] || '已接收';
}

// 获取处理状态样式类
function getProcessStatusClass(status) {
    const classMap = {
        'received': 'status-received',
        'processing': 'status-processing',
        'shipped': 'status-shipped'
    };
    return classMap[status] || 'status-received';
}

// 编辑备注
async function editRemarks(fileId, currentRemarks) {
    // 使用新的模态框编辑备注
    showEditRemarksModal(fileId, currentRemarks);
}

// 删除文件
async function deleteFile(fileId) {
    if (!confirm('确定要删除这个文件吗？删除后可以恢复。')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/uploads/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('文件删除成功');
            
            // 刷新列表，如果当前页没有数据了，跳转到上一页
            const response2 = await fetch(`${API_BASE}/uploads?page=${currentPage}&limit=${pageSize}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response2.ok) {
                const result2 = await response2.json();
                if (result2.files.length === 0 && currentPage > 1) {
                    // 当前页没有数据了，跳转到上一页
                    loadUserFiles(currentPage - 1);
                } else {
                    // 保持当前页
                    loadUserFiles(currentPage);
                }
            } else {
                loadUserFiles(currentPage);
            }
        } else {
            showError('uploadError', result.error || '文件删除失败');
        }
        
    } catch (error) {
        showError('uploadError', '网络错误，请稍后重试');
    } finally {
        showLoading(false);
    }
}

// 恢复文件
async function restoreFile(fileId) {
    if (!confirm('确定要恢复这个文件吗？')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/uploads/${fileId}/restore`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('文件恢复成功');
            loadUserFiles(currentPage); // 刷新列表，保持当前页
        } else {
            showError('uploadError', result.error || '文件恢复失败');
        }
        
    } catch (error) {
        showError('uploadError', '网络错误，请稍后重试');
    } finally {
        showLoading(false);
    }
}

// 客户端文件分页（使用通用分页函数）
function displayPagination(pagination) {
    displayUniversalPagination('filesPagination', pagination, {
        loadFunction: loadUserFiles,
        getCurrentPage: () => currentPage,
        setCurrentPage: (page) => { currentPage = page; },
        getPageSize: () => pageSize,
        setPageSize: (size) => { pageSize = size; },
        extraParams: []
    });
}

// 键盘事件处理
document.addEventListener('keydown', function(e) {
    // ESC 键关闭模态框
    if (e.key === 'Escape') {
        closeConfirmModal();
    }
    
    // Enter 键提交表单
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const form = e.target.closest('form');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
});

// 绑定客户端筛选事件
function bindCustomerFilterEvents() {
    // 时间筛选下拉框变化
    const customerTimeFilter = document.getElementById('customerTimeFilter');
    if (customerTimeFilter) {
        customerTimeFilter.addEventListener('change', function() {
            const customDateRange = document.getElementById('customerCustomDateRange');
            if (this.value === 'custom') {
                customDateRange.style.display = 'flex';
            } else {
                customDateRange.style.display = 'none';
            }
        });
    }

    // 筛选按钮
    const customerApplyFilters = document.getElementById('customerApplyFilters');
    if (customerApplyFilters) {
        customerApplyFilters.addEventListener('click', applyCustomerFilters);
    }

    // 清除筛选按钮
    const customerClearFilters = document.getElementById('customerClearFilters');
    if (customerClearFilters) {
        customerClearFilters.addEventListener('click', clearCustomerFilters);
    }
}

// 绑定商家端筛选事件
function bindMerchantFilterEvents() {
    // 时间筛选下拉框变化
    const merchantTimeFilter = document.getElementById('merchantTimeFilter');
    if (merchantTimeFilter) {
        merchantTimeFilter.addEventListener('change', function() {
            const customDateRange = document.getElementById('merchantCustomDateRange');
            if (this.value === 'custom') {
                customDateRange.style.display = 'flex';
            } else {
                customDateRange.style.display = 'none';
            }
        });
    }

    // 筛选按钮
    const merchantApplyFilters = document.getElementById('merchantApplyFilters');
    if (merchantApplyFilters) {
        merchantApplyFilters.addEventListener('click', applyMerchantFilters);
    }

    // 清除筛选按钮
    const merchantClearFilters = document.getElementById('merchantClearFilters');
    if (merchantClearFilters) {
        merchantClearFilters.addEventListener('click', clearMerchantFilters);
    }
}

// 应用客户端筛选
function applyCustomerFilters() {
    const statusFilter = document.getElementById('customerStatusFilter').value;
    const timeFilter = document.getElementById('customerTimeFilter').value;
    const startDate = document.getElementById('customerStartDate').value;
    const endDate = document.getElementById('customerEndDate').value;

    // 验证自定义时间范围
    if (timeFilter === 'custom') {
        if (!startDate || !endDate) {
            alert('请选择完整的时间范围');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            alert('开始时间不能晚于结束时间');
            return;
        }
    }

    // 更新筛选条件
    currentFilters = {
        status: statusFilter,
        timeFilter: timeFilter,
        startDate: timeFilter === 'custom' ? startDate : '',
        endDate: timeFilter === 'custom' ? endDate : ''
    };

    // 重新加载第一页
    currentPage = 1;
    loadUserFiles(1);
}

// 清除客户端筛选
function clearCustomerFilters() {
    document.getElementById('customerStatusFilter').value = '';
    document.getElementById('customerTimeFilter').value = '';
    document.getElementById('customerStartDate').value = '';
    document.getElementById('customerEndDate').value = '';
    document.getElementById('customerCustomDateRange').style.display = 'none';

    // 清除筛选条件
    currentFilters = {};

    // 重新加载第一页
    currentPage = 1;
    loadUserFiles(1);
}

// 应用商家端筛选
function applyMerchantFilters() {
    const statusFilter = document.getElementById('merchantStatusFilter').value;
    const timeFilter = document.getElementById('merchantTimeFilter').value;
    const startDate = document.getElementById('merchantStartDate').value;
    const endDate = document.getElementById('merchantEndDate').value;

    // 验证自定义时间范围
    if (timeFilter === 'custom') {
        if (!startDate || !endDate) {
            alert('请选择完整的时间范围');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            alert('开始时间不能晚于结束时间');
            return;
        }
    }

    // 更新筛选条件
    merchantFilters = {
        status: statusFilter,
        timeFilter: timeFilter,
        startDate: timeFilter === 'custom' ? startDate : '',
        endDate: timeFilter === 'custom' ? endDate : ''
    };

    // 重新加载第一页
    merchantCurrentPage = 1;
    if (window.currentCustomerId) {
        loadCustomerPhotos(window.currentCustomerId, 1);
    }
}

// 清除商家端筛选
function clearMerchantFilters() {
    document.getElementById('merchantStatusFilter').value = '';
    document.getElementById('merchantTimeFilter').value = '';
    document.getElementById('merchantStartDate').value = '';
    document.getElementById('merchantEndDate').value = '';
    document.getElementById('merchantCustomDateRange').style.display = 'none';

    // 清除筛选条件
    merchantFilters = {};

    // 重新加载第一页
    merchantCurrentPage = 1;
    if (window.currentCustomerId) {
        loadCustomerPhotos(window.currentCustomerId, 1);
    }
}

// 检测重复文件
async function checkDuplicateFiles(merchantId, fileNames) {
    try {
        const response = await fetch(`${API_BASE}/check-duplicate-files`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                merchantId: merchantId,
                fileNames: fileNames
            })
        });

        if (response.ok) {
            const result = await response.json();
            return {
                success: true,
                duplicateFiles: result.duplicateFiles
            };
        } else {
            const error = await response.json();
            return {
                success: false,
                error: error.error || '检测重复文件失败'
            };
        }
    } catch (error) {
        console.error('检测重复文件错误:', error);
        return {
            success: false,
            error: '网络错误，请稍后重试'
        };
    }
}

// 显示备注详情模态框
function showRemarksModal(fileId, remarks) {
    if (!remarks || remarks === '-' || remarks.trim() === '') {
        return; // 没有备注内容，不显示模态框
    }
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'remarks-modal';
    modal.innerHTML = `
        <div class="remarks-modal-overlay"></div>
        <div class="remarks-modal-content">
            <div class="remarks-modal-header">
                <h3><i class="fas fa-comment-alt"></i> 备注详情</h3>
                <button class="remarks-modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="remarks-modal-body">
                <div class="remarks-content">${remarks}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加事件监听器
    modal.querySelector('.remarks-modal-overlay').addEventListener('click', closeRemarksModal);
    modal.querySelector('.remarks-modal-close').addEventListener('click', closeRemarksModal);
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleRemarksModalKeydown);
}

// 关闭备注模态框
function closeRemarksModal() {
    const modal = document.querySelector('.remarks-modal');
    if (modal) {
        modal.remove();
        document.removeEventListener('keydown', handleRemarksModalKeydown);
    }
}

// 处理备注模态框的键盘事件
function handleRemarksModalKeydown(e) {
    if (e.key === 'Escape') {
        closeRemarksModal();
    }
}

// 显示编辑备注模态框
function showEditRemarksModal(fileId, currentRemarks) {
    // 解码HTML实体
    const decodedRemarks = currentRemarks.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'edit-remarks-modal';
    modal.innerHTML = `
        <div class="edit-remarks-modal-overlay"></div>
        <div class="edit-remarks-modal-content">
            <div class="edit-remarks-modal-header">
                <h3><i class="fas fa-edit"></i> 编辑备注</h3>
                <button class="edit-remarks-modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="edit-remarks-modal-body">
                <div class="edit-remarks-form">
                    <label for="editRemarksTextarea">备注内容（最多500字符）：</label>
                    <textarea id="editRemarksTextarea" class="edit-remarks-textarea" maxlength="500" placeholder="请输入备注信息...">${decodedRemarks}</textarea>
                    <div class="edit-remarks-counter">
                        <span id="editRemarksCount">${decodedRemarks.length}</span>/500
                    </div>
                </div>
            </div>
            <div class="edit-remarks-modal-footer">
                <button class="btn btn-secondary edit-remarks-cancel">取消</button>
                <button class="btn btn-primary edit-remarks-save">保存</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 获取元素引用
    const textarea = modal.querySelector('#editRemarksTextarea');
    const counter = modal.querySelector('#editRemarksCount');
    const saveBtn = modal.querySelector('.edit-remarks-save');
    const cancelBtn = modal.querySelector('.edit-remarks-cancel');
    const closeBtn = modal.querySelector('.edit-remarks-modal-close');
    const overlay = modal.querySelector('.edit-remarks-modal-overlay');
    
    // 自动调整文本框高度
    function autoResizeTextarea() {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(100, textarea.scrollHeight) + 'px';
    }
    
    // 初始化文本框高度
    setTimeout(autoResizeTextarea, 0);
    
    // 添加事件监听器
    textarea.addEventListener('input', function() {
        counter.textContent = this.value.length;
        autoResizeTextarea();
    });
    
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            // Ctrl+Enter 保存
            saveEditRemarks();
        } else if (e.key === 'Escape') {
            closeEditRemarksModal();
        }
    });
    
    // 保存函数
    async function saveEditRemarks() {
        const newRemarks = textarea.value.trim();
        
        if (newRemarks.length > 500) {
            showError('uploadError', '备注长度不能超过500字符');
            return;
        }
        
        closeEditRemarksModal();
        
        // 调用原有的保存逻辑
        try {
            showLoading(true);
            
            const response = await fetch(`${API_BASE}/uploads/${fileId}/remarks`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ remarks: newRemarks })
            });
            
            const result = await response.json();
            if (response.ok) {
                showSuccess(`备注更新成功！剩余编辑次数：${result.remainingEdits}`);
                
                // 更新显示
                const remarksElement = document.getElementById(`remarks-${fileId}`);
                if (remarksElement) {
                    remarksElement.textContent = newRemarks || '-';
                    remarksElement.setAttribute('title', newRemarks || '');
                    remarksElement.setAttribute('data-remarks', newRemarks.replace(/"/g, '&quot;'));
                }
                
                // 刷新文件列表，保持当前页
                loadUserFiles(currentPage);
            } else {
                showError('uploadError', result.error || '更新备注失败');
            }
        } catch (error) {
            console.error('更新备注错误:', error);
            showError('uploadError', '网络错误，请稍后重试');
        } finally {
            showLoading(false);
        }
    }
    
    // 关闭函数
    function closeEditRemarksModal() {
        const modal = document.querySelector('.edit-remarks-modal');
        if (modal) {
            modal.remove();
            document.removeEventListener('keydown', handleEditRemarksModalKeydown);
        }
    }
    
    // 键盘事件处理
    function handleEditRemarksModalKeydown(e) {
        if (e.key === 'Escape') {
            closeEditRemarksModal();
        }
    }
    
    // 绑定事件
    saveBtn.addEventListener('click', saveEditRemarks);
    cancelBtn.addEventListener('click', closeEditRemarksModal);
    closeBtn.addEventListener('click', closeEditRemarksModal);
    overlay.addEventListener('click', closeEditRemarksModal);
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleEditRemarksModalKeydown);
    
    // 聚焦到文本框并选中所有文本
    setTimeout(() => {
        textarea.focus();
        textarea.select();
    }, 100);
}

// 切换批量下载模式
function toggleBatchMode() {
    batchMode = !batchMode;
    
    const checkboxHeader = document.getElementById('checkboxHeader');
    const batchExtendedControls = document.getElementById('batchExtendedControls');
    const batchDownloadBtn = document.getElementById('batchDownloadBtn');
    
    if (batchMode) {
        // 进入批量模式
        checkboxHeader.style.display = '';
        batchExtendedControls.style.display = 'flex';
        batchDownloadBtn.innerHTML = '<i class="fas fa-times"></i> 退出批量';
        batchDownloadBtn.className = 'btn btn-outline';
        
        // 重新渲染照片列表以显示复选框
        const currentCustomerId = window.currentCustomerId;
        if (currentCustomerId) {
            loadCustomerPhotos(currentCustomerId, merchantCurrentPage);
        }
    } else {
        // 退出批量模式
        checkboxHeader.style.display = 'none';
        batchExtendedControls.style.display = 'none';
        batchDownloadBtn.innerHTML = '<i class="fas fa-download"></i> 批量下载';
        batchDownloadBtn.className = 'btn btn-success';
        
        // 清空选中状态
        selectedPhotos.clear();
        updateSelectedCount();
        
        // 重新渲染照片列表以隐藏复选框
        const currentCustomerId = window.currentCustomerId;
        if (currentCustomerId) {
            loadCustomerPhotos(currentCustomerId, merchantCurrentPage);
        }
    }
}

// 全选当前页照片
function selectAllPhotos() {
    const checkboxes = document.querySelectorAll('.photo-checkbox:not(:disabled)');
    checkboxes.forEach(checkbox => {
        const photoId = parseInt(checkbox.getAttribute('data-photo-id'));
        checkbox.checked = true;
        selectedPhotos.add(photoId);
        checkbox.closest('tr').classList.add('selected');
    });
    
    updateSelectAllCheckbox();
    updateSelectedCount();
}

// 取消选择当前页所有照片
function selectNonePhotos() {
    const checkboxes = document.querySelectorAll('.photo-checkbox');
    checkboxes.forEach(checkbox => {
        const photoId = parseInt(checkbox.getAttribute('data-photo-id'));
        checkbox.checked = false;
        selectedPhotos.delete(photoId);
        checkbox.closest('tr').classList.remove('selected');
    });
    
    updateSelectAllCheckbox();
    updateSelectedCount();
}

// 反选当前页照片
function selectInvertPhotos() {
    const checkboxes = document.querySelectorAll('.photo-checkbox:not(:disabled)');
    checkboxes.forEach(checkbox => {
        const photoId = parseInt(checkbox.getAttribute('data-photo-id'));
        if (checkbox.checked) {
            checkbox.checked = false;
            selectedPhotos.delete(photoId);
            checkbox.closest('tr').classList.remove('selected');
        } else {
            checkbox.checked = true;
            selectedPhotos.add(photoId);
            checkbox.closest('tr').classList.add('selected');
        }
    });
    
    updateSelectAllCheckbox();
    updateSelectedCount();
}

// 处理表头全选复选框
function handleSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox.checked) {
        selectAllPhotos();
    } else {
        selectNonePhotos();
    }
}

// 更新表头全选复选框状态
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.photo-checkbox:not(:disabled)');
    
    if (checkboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }
    
    const checkedBoxes = document.querySelectorAll('.photo-checkbox:not(:disabled):checked');
    
    if (checkedBoxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedBoxes.length === checkboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// 更新选中数量显示
function updateSelectedCount() {
    const selectedCountSpan = document.getElementById('selectedCount');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    
    if (selectedCountSpan) {
        selectedCountSpan.textContent = selectedPhotos.size;
    }
    
    if (downloadSelectedBtn) {
        downloadSelectedBtn.disabled = selectedPhotos.size === 0;
    }
}

// 下载选中的照片
async function downloadSelectedPhotos() {
    if (selectedPhotos.size === 0) {
        alert('请先选择要下载的照片');
        return;
    }
    
    const photoIds = Array.from(selectedPhotos);
    const currentCustomerId = window.currentCustomerId;
    
    try {
        showLoading(true);
        
        // 构建下载URL，包含选中的照片ID
        const params = new URLSearchParams();
        params.append('photoIds', photoIds.join(','));
        params.append('token', authToken);
        
        const downloadUrl = `${API_BASE}/merchant/customer/${currentCustomerId}/download-selected?${params.toString()}`;
        
        console.log('批量下载URL:', downloadUrl);
        console.log('选中的照片IDs:', photoIds);
        console.log('当前客户ID:', currentCustomerId);
        
        // 使用fetch获取文件流
        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('响应状态:', response.status);
        console.log('响应状态文本:', response.statusText);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '下载失败');
        }
        
        // 获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'download.zip';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
            }
        }
        
        // 创建blob并下载
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理blob URL
        window.URL.revokeObjectURL(url);
        
        // 清空选中状态并退出批量模式
        selectedPhotos.clear();
        toggleBatchMode();
        
        showSuccess(`成功下载 ${photoIds.length} 个文件`);
        
    } catch (error) {
        console.error('批量下载错误:', error);
        alert(`下载失败：${error.message}`);
    } finally {
        showLoading(false);
    }
}

// 绑定页面切换事件
function bindPageSwitchEvents() {
    console.log('绑定页面切换事件...');
    
    // 修改密码链接
    const showChangePasswordLink = document.getElementById('showChangePasswordLink');
    if (showChangePasswordLink) {
        showChangePasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showChangePasswordPage();
        });
    }
    
    // 找回密码链接
    const showForgotPasswordLink = document.getElementById('showForgotPasswordLink');
    if (showForgotPasswordLink) {
        showForgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showForgotPasswordPage();
        });
    }
    
    // 从修改密码页面返回登录
    const backToLoginFromChange = document.getElementById('backToLoginFromChange');
    if (backToLoginFromChange) {
        backToLoginFromChange.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
        });
    }
    
    // 从找回密码页面返回登录
    const backToLoginFromForgot = document.getElementById('backToLoginFromForgot');
    if (backToLoginFromForgot) {
        backToLoginFromForgot.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
        });
    }
    
    // 修改密码表单提交
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }
}

// 显示修改密码页面
function showChangePasswordPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('changePasswordPage').classList.add('active');
    document.getElementById('forgotPasswordPage').classList.remove('active');
    
    // 清空表单
    document.getElementById('changePasswordForm').reset();
    document.getElementById('changePasswordError').style.display = 'none';
    document.getElementById('changePasswordSuccess').style.display = 'none';
}

// 显示找回密码页面
function showForgotPasswordPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('changePasswordPage').classList.remove('active');
    document.getElementById('forgotPasswordPage').classList.add('active');
}

// 处理修改密码
async function handleChangePassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const oldPassword = formData.get('oldPassword');
    const newPassword = formData.get('newPassword');
    const confirmNewPassword = formData.get('confirmNewPassword');
    
    // 前端验证
    if (!username || !oldPassword || !newPassword || !confirmNewPassword) {
        showError('changePasswordError', '请填写所有字段');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        showError('changePasswordError', '两次输入的新密码不一致');
        return;
    }
    
    if (newPassword.length < 6) {
        showError('changePasswordError', '新密码至少需要6个字符');
        return;
    }
    
    if (oldPassword === newPassword) {
        showError('changePasswordError', '新密码不能与旧密码相同');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                oldPassword,
                newPassword
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showChangePasswordSuccess('修改密码成功！请使用新密码登录。');
            // 3秒后跳转到登录页面
            setTimeout(() => {
                showLogin();
            }, 3000);
        } else {
            showError('changePasswordError', result.error || '修改密码失败');
        }
    } catch (error) {
        console.error('修改密码错误:', error);
        showError('changePasswordError', '网络错误，请稍后重试');
    }
}

// 显示成功消息（修改密码专用）
function showChangePasswordSuccess(message) {
    const successElement = document.getElementById('changePasswordSuccess');
    const errorElement = document.getElementById('changePasswordError');
    
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
}

// 翻译操作记录
function translateOperation(operation) {
    return operationTranslations[operation] || operation;
}

// 翻译详情内容
function translateDetails(details) {
    if (!details) return details;
    
    let translatedDetails = details;
    
    // 替换状态变更中的英文状态
    Object.keys(operationTranslations).forEach(key => {
        const regex = new RegExp(key, 'g');
        translatedDetails = translatedDetails.replace(regex, operationTranslations[key]);
    });
    
    // 处理状态变更箭头格式 (如: received -> processing)
    translatedDetails = translatedDetails.replace(/(\w+)\s*->\s*(\w+)/g, (match, from, to) => {
        const fromChinese = operationTranslations[from] || from;
        const toChinese = operationTranslations[to] || to;
        return `${fromChinese} → ${toChinese}`;
    });
    
    // 处理角色显示 (如: 角色: merchant -> 角色: 商家)
    translatedDetails = translatedDetails.replace(/角色:\s*(\w+)/g, (match, role) => {
        const roleChinese = getRoleText(role);
        return `角色: ${roleChinese}`;
    });
    
    // 处理状态显示 (如: 状态: active -> 状态: 正常)
    translatedDetails = translatedDetails.replace(/状态:\s*(\w+)/g, (match, status) => {
        const statusChinese = operationTranslations[status] || status;
        return `状态: ${statusChinese}`;
    });
    
    // 处理理由显示格式优化
    translatedDetails = translatedDetails.replace(/理由:\s*([^,]+)/g, '理由: $1');
    
    // 处理ID显示格式优化
    translatedDetails = translatedDetails.replace(/\(ID:\s*(\d+)\)/g, '(ID: $1)');
    
    // 处理用户名和ID之间的空格
    translatedDetails = translatedDetails.replace(/用户:\s*([^(]+)\s*\(/g, '用户: $1 (');
    
    return translatedDetails;
}

// 操作记录分页显示（使用通用分页函数）
function displayLogsPagination(pagination) {
    displayUniversalPagination('logsPagination', pagination, {
        loadFunction: (page) => loadLogs(page),
        getCurrentPage: () => currentLogsPage,
        setCurrentPage: (page) => { currentLogsPage = page; },
        getPageSize: () => logsPageSize,
        setPageSize: (size) => { logsPageSize = size; },
        extraParams: []
    });
}
