"""
customer_segmentation.py
Offline Data Science tool to aggregate sales transactions, compute RFM metrics,
and cluster customers using scikit-learn K-Means.
"""

import os
import argparse
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# Set style for high-end visualizations
sns.set_theme(style="darkgrid")
plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.size': 11,
    'figure.titlesize': 16,
    'axes.labelsize': 12,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10
})

def load_data(file_path):
    """Loads transaction-level dataset and verifies required columns."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Source file not found at: {file_path}")
    
    print(f"[+] Loading transaction data from {file_path}...")
    df = pd.read_csv(file_path)
    
    # Standardize column casing
    df.columns = [col.strip() for col in df.columns]
    
    required_cols = ['Date', 'Revenue', 'Sales', 'CustomerID', 'CustomerName']
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"CRITICAL: Missing required columns in CSV: {missing}")
        
    df['Date'] = pd.to_datetime(df['Date'])
    df['Revenue'] = pd.to_numeric(df['Revenue'], errors='coerce').fillna(0)
    df['Sales'] = pd.to_numeric(df['Sales'], errors='coerce').fillna(1)
    df['CustomerID'] = df['CustomerID'].astype(str)
    df['CustomerName'] = df['CustomerName'].astype(str)
    
    return df

def calculate_rfm(df):
    """Aggregates transaction-level data to customer-level Recency, Frequency, Monetary metrics."""
    print("[*] Computing Recency, Frequency, and Monetary (RFM) metrics...")
    
    # Reference date is the day after the last transaction
    ref_date = df['Date'].max() + pd.Timedelta(days=1)
    
    rfm = df.groupby('CustomerID').agg({
        'Date': lambda x: (ref_date - x.max()).days, # Recency
        'Sales': 'sum',                             # Frequency (order count)
        'Revenue': 'sum',                           # Monetary (total spent)
        'CustomerName': 'first'                     # Keep customer name
    }).reset_index()
    
    rfm.rename(columns={
        'Date': 'Recency',
        'Sales': 'Frequency',
        'Revenue': 'Monetary'
    }, inplace=True)
    
    # Filter out empty records or negative values
    rfm = rfm[rfm['Monetary'] > 0]
    
    print(f"[+] Profiled {len(rfm)} unique customer accounts.")
    return rfm

def find_optimal_k(scaled_features, max_k=8):
    """Helper to evaluate optimal cluster size using Within-Cluster Sum of Squares (Elbow) and Silhouette Scores."""
    wcss = []
    silhouette_avg = []
    k_range = range(2, max_k + 1)
    
    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        kmeans.fit(scaled_features)
        wcss.append(kmeans.inertia_)
        silhouette_avg.append(silhouette_score(scaled_features, kmeans.labels_))
        
    return list(k_range), wcss, silhouette_avg

def profile_clusters(rfm, labels):
    """Profiles and labels K-Means clusters based on RFM coordinates."""
    rfm['Cluster'] = labels
    
    cluster_stats = rfm.groupby('Cluster').agg({
        'Recency': 'mean',
        'Frequency': 'mean',
        'Monetary': 'mean',
        'CustomerID': 'count'
    }).rename(columns={'CustomerID': 'Count'}).reset_index()
    
    # Calculate global averages
    global_r = rfm['Recency'].mean()
    global_f = rfm['Frequency'].mean()
    global_m = rfm['Monetary'].mean()
    
    # Map semantically
    persona_map = {}
    for _, row in cluster_stats.iterrows():
        c_idx = int(row['Cluster'])
        r, f, m = row['Recency'], row['Frequency'], row['Monetary']
        
        is_recent = r < global_r
        is_frequent = f >= global_f
        is_high_value = m >= global_m
        
        if is_recent and is_frequent and is_high_value:
            persona = "VIP Champions"
        elif not is_recent and is_frequent and is_high_value:
            persona = "At-Risk VIPs"
        elif is_recent and not is_frequent and not is_high_value:
            persona = "New Trialers"
        elif not is_recent and not is_frequent and not is_high_value:
            persona = "Lost / Churned"
        elif is_recent and is_frequent and not is_high_value:
            persona = "Loyal Value Seekers"
        elif not is_recent and not is_frequent and is_high_value:
            persona = "Occasional High Spenders"
        else:
            persona = f"Standard Group {c_idx}"
            
        persona_map[c_idx] = persona
        
    rfm['Segment'] = rfm['Cluster'].map(persona_map)
    return rfm, cluster_stats, persona_map

def plot_and_save_visualizations(rfm, k_range, wcss, sil_scores, out_dir):
    """Generates and saves premium data science visualizations."""
    os.makedirs(out_dir, exist_ok=True)
    print(f"[*] Saving premium visualizations to '{out_dir}'...")
    
    # 1. Elbow Method & Silhouette Chart
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
    
    ax1.plot(k_range, wcss, 'o-', color='#4f8ef7', linewidth=2.5, markersize=8)
    ax1.set_title('Elbow Method (Inertia Curve)', pad=15)
    ax1.set_xlabel('Number of Clusters (k)')
    ax1.set_ylabel('Inertia (Within-Cluster Sum of Squares)')
    ax1.set_xticks(k_range)
    
    ax2.bar(k_range, sil_scores, color='#00d4aa', alpha=0.8, edgecolor='#00ab8a')
    ax2.set_title('Silhouette Analysis', pad=15)
    ax2.set_xlabel('Number of Clusters (k)')
    ax2.set_ylabel('Average Silhouette Coefficient')
    ax2.set_xticks(k_range)
    
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, 'clustering_metrics.png'), dpi=300)
    plt.close()
    
    # 2. Scatter Plot: Recency vs Frequency
    plt.figure(figsize=(10, 7))
    sns.scatterplot(
        data=rfm, x='Recency', y='Frequency', hue='Segment', palette='turbo',
        size='Monetary', sizes=(50, 400), alpha=0.75, edgecolor='black', linewidth=0.5
    )
    plt.title('Customer Segments: Recency vs Purchase Frequency', pad=15)
    plt.xlabel('Recency (Days since last order — lower is more recent)')
    plt.ylabel('Frequency (Total purchases)')
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, 'segment_scatter_rec_freq.png'), dpi=300)
    plt.close()

    # 3. Scatter Plot: Frequency vs Monetary Value
    plt.figure(figsize=(10, 7))
    sns.scatterplot(
        data=rfm, x='Frequency', y='Monetary', hue='Segment', palette='turbo',
        size='Recency', sizes=(400, 50), alpha=0.75, edgecolor='black', linewidth=0.5
    )
    plt.title('Customer Segments: Frequency vs Monetary Spend (LTV)', pad=15)
    plt.xlabel('Frequency (Total purchases)')
    plt.ylabel('Monetary Spend ($)')
    plt.yscale('log') # Log scale since monetary value can span several orders of magnitude
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, 'segment_scatter_freq_mon.png'), dpi=300)
    plt.close()

    # 4. 3D Cluster Visualizer
    fig = plt.figure(figsize=(12, 9))
    ax = fig.add_subplot(111, projection='3d')
    
    # Assign integer mapping to hue for 3D visualization
    unique_segments = rfm['Segment'].unique()
    colors = plt.cm.turbo(np.linspace(0, 1, len(unique_segments)))
    seg_color_map = dict(zip(unique_segments, colors))
    
    for seg in unique_segments:
        sub = rfm[rfm['Segment'] == seg]
        ax.scatter(
            sub['Recency'], sub['Frequency'], sub['Monetary'],
            label=seg, c=[seg_color_map[seg]], s=80, alpha=0.7, edgecolor='k', linewidth=0.2
        )
        
    ax.set_title('3D Multi-Dimensional RFM Customer Clusters', pad=15)
    ax.set_xlabel('Recency (Days)')
    ax.set_ylabel('Frequency (Purchases)')
    ax.set_zlabel('Monetary Value ($)')
    ax.legend(loc='upper right')
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, 'segment_3d_rfm.png'), dpi=300)
    plt.close()

def main():
    parser = argparse.ArgumentParser(description="Run Offline Customer Segmentation & Clustering.")
    parser.add_argument('--input', type=str, default='sales_export.csv', help='Path to transaction CSV file.')
    parser.add_argument('--k', type=int, default=4, help='Number of clusters to train K-Means (default: 4).')
    parser.add_argument('--outdir', type=str, default='segmentation_plots', help='Directory to save output plots.')
    parser.add_argument('--export', type=str, default='customer_segments_export.csv', help='Path to save profiled customer segments.')
    args = parser.parse_args()

    # If input doesn't exist, check for default exported csv or notify user
    if not os.path.exists(args.input):
        print(f"[-] Input file '{args.input}' not found in current folder.")
        print("[-] Please run 'Export CSV' in the RevIQ web dashboard or place a valid transaction CSV here.")
        return

    try:
        # Load and clean transaction data
        df = load_data(args.input)
        
        # Aggregate to RFM metrics
        rfm = calculate_rfm(df)
        
        # Prepare and Scale metrics for clustering
        features = rfm[['Recency', 'Frequency', 'Monetary']].values
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(features)
        
        # Compute optimal K metrics for visual logs
        print("[*] Running Elbow and Silhouette evaluations across K = 2..8...")
        k_range, wcss, sil_scores = find_optimal_k(scaled_features)
        best_k = k_range[np.argmax(sil_scores)]
        print(f"[+] Optimal clusters detected by Silhouette Score: k = {best_k} (score: {sil_scores[np.argmax(sil_scores)]:.3f})")
        
        # Fit K-Means on requested k
        print(f"[*] Fitting K-Means with k = {args.k} clusters...")
        kmeans = KMeans(n_clusters=args.k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(scaled_features)
        
        # Profile clusters and map semantically to personas
        rfm, stats, persona_map = profile_clusters(rfm, labels)
        
        print("\n" + "="*50)
        print("CUSTOMER PROFILE STATISTICAL SEGMENTS SUMMARY")
        print("="*50)
        for _, row in stats.iterrows():
            c_idx = int(row['Cluster'])
            persona = persona_map[c_idx]
            print(f"Cluster #{c_idx} - {persona}:")
            print(f"  - Count:     {int(row['Count'])} customers ({row['Count']/len(rfm)*100:.1f}%)")
            print(f"  - Avg Recency:   {row['Recency']:.1f} days")
            print(f"  - Avg Frequency: {row['Frequency']:.1f} purchases")
            print(f"  - Avg Monetary:  ${row['Monetary']:.2f}")
            print("-"*50)
            
        # Export final profiled CSV
        rfm.to_csv(args.export, index=False)
        print(f"\n[+] Profitably segmented profiles exported to: {args.export}")
        
        # Generate & save high-end plots
        plot_and_save_visualizations(rfm, k_range, wcss, sil_scores, args.outdir)
        print("[+] Finished successfully. All plots and exports compiled!")
        
    except Exception as e:
        print(f"\n[CRITICAL ERROR] Failed to process segmentation: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
